import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Address,
  ChatConversation,
  ChatConversationStatus,
  ChatMessage,
  ChatMessageStatus,
  ChatSenderRole,
  FileEntity,
  User,
} from 'src/entities';
import {
  CHAT_MAX_ATTACHMENTS,
} from 'src/entities/enums/chat.enum';
import {
  CHAT_MAX_BODY_LENGTH,
  sanitizeChatBody,
} from 'src/modules/chat/chat.limits';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { In, Repository } from 'typeorm';

export type SendMessageInput = {
  clientMsgId: string;
  body?: string;
  fileUuid?: string | null;
  replyToMessageUuid?: string | null;
  sender: User;
  senderRole: ChatSenderRole.CUSTOMER | ChatSenderRole.ADMIN;
  conversationUuid: string;
};

const ACTIVE_STATUSES = [
  ChatConversationStatus.OPEN,
  ChatConversationStatus.WAITING,
];

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepo: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    private readonly storageService: StorageService,
  ) {}

  mediaPath(fileUuid: string | null | undefined) {
    if (!fileUuid) return null;
    return `/public/media/${fileUuid}`;
  }

  async getConversationByUuid(uuid: string) {
    const conv = await this.conversationRepo.findOne({
      where: { uuid },
      relations: ['customer'],
    });
    if (!conv) throw new NotFoundException('گفتگو پیدا نشد.');
    return conv;
  }

  async findActiveForCustomer(customerId: number) {
    return this.conversationRepo.findOne({
      where: ACTIVE_STATUSES.map((status) => ({ customerId, status })) as any,
      relations: ['customer'],
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });
  }

  /** Prefer single query with IN */
  async getActiveConversation(customerId: number) {
    return this.conversationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.customer', 'customer')
      .where('c.customerId = :cid', { cid: customerId })
      .andWhere('c.status IN (:...st)', { st: ACTIVE_STATUSES })
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.createdAt', 'DESC')
      .getOne();
  }

  async listCustomerConversations(customer: User) {
    const rows = await this.conversationRepo.find({
      where: { customerId: customer.id },
      relations: ['customer'],
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });
    const active = rows.find((r) => ACTIVE_STATUSES.includes(r.status)) || null;
    return {
      success: true,
      data: rows.map((c) => this.mapConversation(c)),
      meta: {
        activeUuid: active?.uuid || null,
        canStartNew: !active,
        total: rows.length,
        open: rows.filter((r) => r.status === ChatConversationStatus.OPEN)
          .length,
        waiting: rows.filter(
          (r) => r.status === ChatConversationStatus.WAITING,
        ).length,
        closed: rows.filter((r) => r.status === ChatConversationStatus.CLOSED)
          .length,
      },
    };
  }

  async startConversation(customer: User, subject?: string) {
    const active = await this.getActiveConversation(customer.id);
    if (active) {
      throw new BadRequestException(
        'شما یک گفتگوی باز دارید. لطفاً داخل همان گفتگو پیام بگذارید.',
      );
    }
    const conv = await this.conversationRepo.save(
      this.conversationRepo.create({
        customer,
        customerId: customer.id,
        status: ChatConversationStatus.OPEN,
        subject: (subject || '').trim().slice(0, 160) || null,
        lastMessageAt: null,
        lastMessagePreview: null,
        customerUnreadCount: 0,
        adminUnreadCount: 0,
        attachmentCount: 0,
        closedAt: null,
      }),
    );
    conv.customer = customer;
    return { success: true, data: this.mapConversation(conv) };
  }

  async assertCustomerOwns(customer: User, conversationUuid: string) {
    const conv = await this.getConversationByUuid(conversationUuid);
    if (conv.customerId !== customer.id) {
      throw new ForbiddenException('دسترسی ندارید.');
    }
    return conv;
  }

  async listConversationsForAdmin(opts?: {
    q?: string;
    unreadOnly?: boolean;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
    const qb = this.conversationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.customer', 'customer')
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.createdAt', 'DESC');

    if (opts?.unreadOnly) {
      qb.andWhere('c.adminUnreadCount > 0');
    }
    if (
      opts?.status &&
      ['open', 'waiting', 'closed'].includes(opts.status)
    ) {
      qb.andWhere('c.status = :st', { st: opts.status });
    }
    const q = (opts?.q || '').trim();
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(
        `(customer.firstName ILIKE :like OR customer.lastName ILIKE :like OR customer.phone ILIKE :like OR customer.email ILIKE :like OR c.lastMessagePreview ILIKE :like)`,
        { like },
      );
    }

    const total = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const customerIds = [
      ...new Set(rows.map((r) => r.customerId).filter(Boolean)),
    ];
    const statsMap = await this.getCustomerChatStats(customerIds);

    return {
      success: true,
      data: rows.map((c) =>
        this.mapConversation(c, statsMap.get(c.customerId)),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit) || 1),
      },
    };
  }

  async getCustomerChatStats(customerIds: number[]) {
    const map = new Map<
      number,
      { total: number; open: number; waiting: number; closed: number }
    >();
    if (!customerIds.length) return map;

    const raw = await this.conversationRepo
      .createQueryBuilder('c')
      .select('c.customerId', 'customerId')
      .addSelect('c.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.customerId IN (:...ids)', { ids: customerIds })
      .groupBy('c.customerId')
      .addGroupBy('c.status')
      .getRawMany<{ customerId: string; status: string; cnt: string }>();

    for (const row of raw) {
      const id = Number(row.customerId);
      const cur = map.get(id) || { total: 0, open: 0, waiting: 0, closed: 0 };
      const n = Number(row.cnt) || 0;
      cur.total += n;
      if (row.status === ChatConversationStatus.OPEN) cur.open += n;
      else if (row.status === ChatConversationStatus.WAITING) cur.waiting += n;
      else if (row.status === ChatConversationStatus.CLOSED) cur.closed += n;
      map.set(id, cur);
    }
    return map;
  }

  async getConversationDetailForAdmin(conversationUuid: string) {
    const conv = await this.getConversationByUuid(conversationUuid);
    const customer = conv.customer as User;
    const addresses = customer
      ? await this.addressRepo.find({
          where: { userId: customer.id },
          order: { isDefault: 'DESC', createdAt: 'DESC' },
        })
      : [];
    const statsMap = await this.getCustomerChatStats(
      customer ? [customer.id] : [],
    );
    const stats = customer ? statsMap.get(customer.id) : undefined;

    return {
      success: true,
      data: {
        conversation: this.mapConversation(conv, stats),
        customer: customer
          ? {
              uuid: customer.uuid,
              firstName: customer.firstName,
              lastName: customer.lastName,
              phone: customer.phone,
              email: customer.email,
              avatar: customer.avatar,
              chatStats: stats || {
                total: 0,
                open: 0,
                waiting: 0,
                closed: 0,
              },
              addresses: addresses.map((a) => ({
                uuid: a.uuid,
                title: a.title,
                firstName: a.firstName,
                lastName: a.lastName,
                phone: a.phone,
                province: a.province,
                city: a.city,
                addressLine1: a.addressLine1,
                addressLine2: a.addressLine2,
                postalCode: a.postalCode,
                isDefault: a.isDefault,
              })),
            }
          : null,
      },
    };
  }

  async adminUnreadTotal() {
    const raw = await this.conversationRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.adminUnreadCount), 0)', 'sum')
      .where('c.status IN (:...st)', { st: ACTIVE_STATUSES })
      .getRawOne<{ sum: string }>();
    return {
      success: true,
      data: { unread: Number(raw?.sum || 0) },
    };
  }

  async listMessages(opts: {
    conversation: ChatConversation;
    before?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 40, 1), 80);
    let beforeCreatedAt: Date | null = null;
    let beforeId: number | null = null;

    if (opts.before) {
      const cursor = await this.messageRepo.findOne({
        where: { uuid: opts.before, conversationId: opts.conversation.id },
      });
      if (cursor) {
        beforeCreatedAt = cursor.createdAt;
        beforeId = cursor.id;
      }
    }

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.file', 'file')
      .leftJoinAndSelect('m.replyTo', 'replyTo')
      .leftJoinAndSelect('replyTo.file', 'replyFile')
      .where('m.conversationId = :cid', { cid: opts.conversation.id })
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(limit + 1);

    if (beforeCreatedAt && beforeId != null) {
      qb.andWhere(
        '(m.createdAt < :beforeAt OR (m.createdAt = :beforeAt AND m.id < :beforeId))',
        { beforeAt: beforeCreatedAt, beforeId },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    slice.reverse();

    return {
      success: true,
      data: slice.map((m) => this.mapMessage(m)),
      meta: {
        hasMore,
        nextBefore: slice.length ? slice[0].uuid : null,
        attachmentCount: opts.conversation.attachmentCount || 0,
        maxAttachments: CHAT_MAX_ATTACHMENTS,
      },
    };
  }

  async customerListMessages(
    customer: User,
    conversationUuid: string,
    before?: string,
    limit?: number,
  ) {
    const conv = await this.assertCustomerOwns(customer, conversationUuid);
    return this.listMessages({ conversation: conv, before, limit });
  }

  async adminListMessages(
    conversationUuid: string,
    before?: string,
    limit?: number,
  ) {
    const conv = await this.getConversationByUuid(conversationUuid);
    return this.listMessages({ conversation: conv, before, limit });
  }

  async sendMessage(input: SendMessageInput) {
    const clientMsgId = (input.clientMsgId || '').trim();
    if (
      !clientMsgId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        clientMsgId,
      )
    ) {
      throw new BadRequestException('clientMsgId نامعتبر است.');
    }
    if (!input.conversationUuid) {
      throw new BadRequestException('conversationUuid الزامی است.');
    }

    const existing = await this.messageRepo.findOne({
      where: { clientMsgId },
      relations: [
        'sender',
        'file',
        'replyTo',
        'replyTo.file',
        'conversation',
        'conversation.customer',
      ],
    });
    if (existing) {
      return {
        message: this.mapMessage(existing),
        conversation: this.mapConversation(existing.conversation),
        created: false,
        read: null,
      };
    }

    const body = sanitizeChatBody(input.body || '');
    const file = input.fileUuid
      ? await this.resolveChatFile(input.fileUuid)
      : null;

    if (!body && !file) {
      throw new BadRequestException('متن یا تصویر الزامی است.');
    }
    if (body.length > CHAT_MAX_BODY_LENGTH) {
      throw new BadRequestException(
        `متن پیام حداکثر ${CHAT_MAX_BODY_LENGTH} کاراکتر است.`,
      );
    }

    const conversation = await this.getConversationByUuid(
      input.conversationUuid,
    );

    if (input.senderRole === ChatSenderRole.CUSTOMER) {
      if (conversation.customerId !== input.sender.id) {
        throw new ForbiddenException('دسترسی ندارید.');
      }
      if (conversation.status === ChatConversationStatus.CLOSED) {
        throw new BadRequestException(
          'این گفتگو بسته شده است. گفتگوی جدید باز کنید.',
        );
      }
    } else if (conversation.status === ChatConversationStatus.CLOSED) {
      throw new BadRequestException(
        'این گفتگو بسته است. ابتدا بازگشایی کنید.',
      );
    }

    let replyTo: ChatMessage | null = null;
    if (input.replyToMessageUuid) {
      replyTo = await this.messageRepo.findOne({
        where: {
          uuid: input.replyToMessageUuid,
          conversationId: conversation.id,
        },
        relations: ['file'],
      });
      if (!replyTo) {
        throw new BadRequestException('پیام ریپلای معتبر نیست.');
      }
    }

    if (file) {
      const count = conversation.attachmentCount || 0;
      if (count >= CHAT_MAX_ATTACHMENTS) {
        throw new BadRequestException(
          `حداکثر ${CHAT_MAX_ATTACHMENTS} تصویر در هر گفتگو مجاز است.`,
        );
      }
      const alreadyUsed = await this.messageRepo.exist({
        where: { fileId: file.id },
      });
      if (alreadyUsed) {
        throw new BadRequestException('این فایل قبلاً استفاده شده است.');
      }
    }

    const now = new Date();
    const preview = body ? body.slice(0, 120) : file ? '📷 تصویر' : '';

    let message: ChatMessage;
    try {
      message = await this.messageRepo.save(
        this.messageRepo.create({
          conversation,
          conversationId: conversation.id,
          sender: input.sender,
          senderId: input.sender.id,
          senderRole: input.senderRole,
          body: body || '',
          file: file || null,
          fileId: file?.id ?? null,
          replyTo: replyTo || null,
          replyToMessageId: replyTo?.id ?? null,
          clientMsgId,
          status: ChatMessageStatus.DELIVERED,
          deliveredAt: now,
          readAt: null,
        }),
      );
    } catch (err: any) {
      if (
        err?.code === '23505' ||
        String(err?.message || '').includes('unique') ||
        String(err?.driverError?.code) === '23505'
      ) {
        const again = await this.messageRepo.findOne({
          where: { clientMsgId },
          relations: [
            'sender',
            'file',
            'replyTo',
            'replyTo.file',
            'conversation',
            'conversation.customer',
          ],
        });
        if (again) {
          return {
            message: this.mapMessage(again),
            conversation: this.mapConversation(again.conversation),
            created: false,
            read: null,
          };
        }
      }
      throw err;
    }

    conversation.lastMessageAt = now;
    conversation.lastMessagePreview = preview;
    if (file) {
      conversation.attachmentCount = (conversation.attachmentCount || 0) + 1;
    }

    if (input.senderRole === ChatSenderRole.CUSTOMER) {
      conversation.adminUnreadCount = (conversation.adminUnreadCount || 0) + 1;
      conversation.status = ChatConversationStatus.WAITING;
    } else {
      conversation.customerUnreadCount =
        (conversation.customerUnreadCount || 0) + 1;
      if (conversation.status === ChatConversationStatus.WAITING) {
        conversation.status = ChatConversationStatus.OPEN;
      }
    }
    await this.conversationRepo.save(conversation);

    // Answering marks the peer's prior messages as read (double-tick)
    const read = await this.markRead({
      conversationUuid: input.conversationUuid,
      readerRole: input.senderRole,
      reader: input.sender,
    });

    message.sender = input.sender;
    message.file = file || null;
    message.replyTo = replyTo;
    message.conversation = conversation;

    const fullConv = await this.conversationRepo.findOne({
      where: { id: conversation.id },
      relations: ['customer'],
    });

    return {
      message: this.mapMessage(message),
      conversation: this.mapConversation(fullConv || conversation),
      created: true,
      read:
        read.messageUuids.length > 0
          ? {
              messageUuids: read.messageUuids,
              readAt: read.readAt,
              conversation: read.conversation,
            }
          : null,
    };
  }

  async markRead(opts: {
    conversationUuid: string;
    readerRole: ChatSenderRole.CUSTOMER | ChatSenderRole.ADMIN;
    reader: User;
    upToMessageUuid?: string;
  }) {
    const conv = await this.getConversationByUuid(opts.conversationUuid);

    if (opts.readerRole === ChatSenderRole.CUSTOMER) {
      if (conv.customerId !== opts.reader.id) {
        throw new ForbiddenException('دسترسی ندارید.');
      }
    }

    const targetRole =
      opts.readerRole === ChatSenderRole.ADMIN
        ? ChatSenderRole.CUSTOMER
        : ChatSenderRole.ADMIN;

    const unreadQb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :cid', { cid: conv.id })
      .andWhere('m.senderRole = :role', { role: targetRole })
      .andWhere('m.readAt IS NULL');

    if (opts.upToMessageUuid) {
      const upTo = await this.messageRepo.findOne({
        where: { uuid: opts.upToMessageUuid, conversationId: conv.id },
      });
      if (upTo) {
        unreadQb.andWhere(
          '(m.createdAt < :at OR (m.createdAt = :at AND m.id <= :id))',
          { at: upTo.createdAt, id: upTo.id },
        );
      }
    }

    const unread = await unreadQb.getMany();
    const messageUuids = unread.map((m) => m.uuid);
    const readAt = new Date();

    if (messageUuids.length) {
      await this.messageRepo.update(
        { uuid: In(messageUuids) },
        { readAt, status: ChatMessageStatus.READ },
      );
    }

    if (opts.readerRole === ChatSenderRole.ADMIN) {
      conv.adminUnreadCount = 0;
    } else {
      conv.customerUnreadCount = 0;
    }
    await this.conversationRepo.save(conv);

    const full = await this.conversationRepo.findOne({
      where: { id: conv.id },
      relations: ['customer'],
    });

    return {
      messageUuids,
      readAt: readAt.toISOString(),
      conversation: this.mapConversation(full || conv),
    };
  }

  async setConversationStatus(
    conversationUuid: string,
    status: ChatConversationStatus,
  ) {
    const conv = await this.getConversationByUuid(conversationUuid);

    if (status === ChatConversationStatus.OPEN) {
      // Only one active chat per customer
      const other = await this.conversationRepo
        .createQueryBuilder('c')
        .where('c.customerId = :cid', { cid: conv.customerId })
        .andWhere('c.id != :id', { id: conv.id })
        .andWhere('c.status IN (:...st)', { st: ACTIVE_STATUSES })
        .getOne();
      if (other) {
        throw new BadRequestException(
          'این مشتری گفتگوی باز دیگری دارد. ابتدا آن را ببندید.',
        );
      }
      conv.closedAt = null;
    }

    if (status === ChatConversationStatus.CLOSED) {
      conv.closedAt = new Date();
    }

    conv.status = status;
    await this.conversationRepo.save(conv);
    const full = await this.conversationRepo.findOne({
      where: { id: conv.id },
      relations: ['customer'],
    });
    return {
      success: true,
      data: this.mapConversation(full || conv),
    };
  }

  async resolveChatFile(fileUuid: string) {
    const file = await this.fileRepo.findOne({ where: { uuid: fileUuid } });
    if (!file || file.namespace !== StorageNamespace.CHAT) {
      throw new BadRequestException('فایل چت معتبر نیست.');
    }
    return file;
  }

  mapConversation(
    c: ChatConversation,
    chatStats?: {
      total: number;
      open: number;
      waiting: number;
      closed: number;
    },
  ) {
    const customer = c.customer as User | undefined;
    return {
      uuid: c.uuid,
      status: c.status,
      subject: c.subject,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      customerUnreadCount: c.customerUnreadCount || 0,
      adminUnreadCount: c.adminUnreadCount || 0,
      attachmentCount: c.attachmentCount || 0,
      maxAttachments: CHAT_MAX_ATTACHMENTS,
      closedAt: c.closedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      customer: customer
        ? {
            uuid: customer.uuid,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            email: customer.email,
            avatar: customer.avatar,
            chatStats: chatStats || null,
          }
        : null,
    };
  }

  mapMessage(m: ChatMessage) {
    const sender = m.sender as User | undefined;
    const file = m.file as FileEntity | undefined;
    const reply = m.replyTo as ChatMessage | undefined | null;
    return {
      uuid: m.uuid,
      clientMsgId: m.clientMsgId,
      body: m.body,
      senderRole: m.senderRole,
      status: m.status,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
      createdAt: m.createdAt,
      replyTo: reply
        ? {
            uuid: reply.uuid,
            body: (reply.body || '').slice(0, 140),
            senderRole: reply.senderRole,
            hasFile: Boolean(reply.fileId || reply.file),
          }
        : null,
      sender: sender
        ? {
            uuid: sender.uuid,
            firstName: sender.firstName,
            lastName: sender.lastName,
          }
        : null,
      file: file
        ? {
            uuid: file.uuid,
            originalName: file.originalName,
            mimeType: file.mimeType,
            imageUrl: this.mediaPath(file.uuid),
          }
        : null,
    };
  }
}
