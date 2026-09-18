import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FileEntity,
  SupportTicket,
  SupportTicketMessage,
  TicketStatus,
  User,
} from 'src/entities';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { Repository } from 'typeorm';
import {
  AdminEditMessageDto,
  AdminUpdateTicketDto,
  ReplyTicketDto,
} from '../../customer/dto/ticket.dto';

@Injectable()
export class AdminTicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage)
    private readonly messageRepo: Repository<SupportTicketMessage>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly storageService: StorageService,
  ) {}

  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [total, open, pending, answered, closed, today, awaiting] =
      await Promise.all([
        this.ticketRepo.count(),
        this.ticketRepo.count({ where: { status: TicketStatus.OPEN } }),
        this.ticketRepo.count({ where: { status: TicketStatus.PENDING } }),
        this.ticketRepo.count({ where: { status: TicketStatus.ANSWERED } }),
        this.ticketRepo.count({ where: { status: TicketStatus.CLOSED } }),
        this.ticketRepo
          .createQueryBuilder('t')
          .where('t.createdAt >= :start', { start: startOfDay })
          .getCount(),
        this.ticketRepo
          .createQueryBuilder('t')
          .where('t.status IN (:...st)', {
            st: [TicketStatus.OPEN, TicketStatus.PENDING],
          })
          .getCount(),
      ]);

    const recent = await this.ticketRepo.find({
      relations: ['user'],
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
      take: 6,
    });

    return {
      total,
      open,
      pending,
      answered,
      closed,
      today,
      awaiting,
      recent: recent.map((t) => this.mapSummary(t)),
    };
  }

  async list(opts: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'user')
      .orderBy('t.lastMessageAt', 'DESC')
      .addOrderBy('t.createdAt', 'DESC');

    if (opts.status === 'awaiting') {
      qb.andWhere('t.status IN (:...awaiting)', {
        awaiting: [TicketStatus.OPEN, TicketStatus.PENDING],
      });
    } else if (opts.status) {
      qb.andWhere('t.status = :status', { status: opts.status });
    }
    if (opts.search?.trim()) {
      const q = `%${opts.search.trim()}%`;
      qb.andWhere(
        '(t.subject ILIKE :q OR t.publicId ILIKE :q OR user.phone ILIKE :q OR user.firstName ILIKE :q OR user.lastName ILIKE :q)',
        { q },
      );
    }

    const total = await qb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    return {
      success: true,
      data: rows.map((t) => this.mapSummary(t)),
      meta: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
      },
    };
  }

  async get(uuid: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { uuid },
      relations: ['user'],
    });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    const messages = await this.messageRepo.find({
      where: { ticketId: ticket.id },
      relations: ['author', 'file'],
      order: { createdAt: 'ASC' },
    });
    return {
      success: true,
      data: {
        ...this.mapSummary(ticket),
        messages: await Promise.all(
          messages.map((m) => this.mapMessage(m, ticket.uuid)),
        ),
      },
    };
  }

  async update(uuid: string, dto: AdminUpdateTicketDto) {
    const ticket = await this.ticketRepo.findOne({ where: { uuid } });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    if (dto.subject !== undefined) ticket.subject = dto.subject.trim();
    if (dto.category !== undefined) ticket.category = dto.category;
    if (dto.priority !== undefined) ticket.priority = dto.priority;
    if (dto.status !== undefined) {
      ticket.status = dto.status;
      ticket.closedAt =
        dto.status === TicketStatus.CLOSED ? new Date() : null;
    }
    await this.ticketRepo.save(ticket);
    return this.get(uuid);
  }

  async reply(admin: User, uuid: string, dto: ReplyTicketDto) {
    const ticket = await this.ticketRepo.findOne({ where: { uuid } });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('تیکت بسته است — ابتدا باز کنید.');
    }
    const file = dto.fileUuid
      ? await this.resolveTicketFile(dto.fileUuid)
      : null;

    await this.messageRepo.save(
      this.messageRepo.create({
        ticket,
        author: admin,
        isStaff: true,
        body: dto.body.trim(),
        file: file || null,
        isEdited: false,
        editedAt: null,
      }),
    );

    ticket.lastMessageAt = new Date();
    ticket.status = TicketStatus.ANSWERED;
    await this.ticketRepo.save(ticket);
    return this.get(uuid);
  }

  async editMessage(ticketUuid: string, messageUuid: string, dto: AdminEditMessageDto) {
    const ticket = await this.ticketRepo.findOne({ where: { uuid: ticketUuid } });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    const message = await this.messageRepo.findOne({
      where: { uuid: messageUuid, ticketId: ticket.id },
    });
    if (!message) throw new NotFoundException('پیام پیدا نشد.');
    message.body = dto.body.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await this.messageRepo.save(message);
    return this.get(ticketUuid);
  }

  async getFileMeta(ticketUuid: string, fileUuid: string) {
    const ticket = await this.ticketRepo.findOne({ where: { uuid: ticketUuid } });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    const messages = await this.messageRepo.find({
      where: { ticketId: ticket.id },
      relations: ['file'],
    });
    const hit = messages.find(
      (m) => (m.file as FileEntity | undefined)?.uuid === fileUuid,
    );
    const file = hit?.file as FileEntity | undefined;
    if (!file) throw new NotFoundException('فایل پیدا نشد.');
    return file;
  }

  private async resolveTicketFile(fileUuid: string) {
    const file = await this.fileRepo.findOne({ where: { uuid: fileUuid } });
    if (!file) throw new NotFoundException('فایل پیدا نشد.');
    if (file.namespace !== StorageNamespace.TICKETS) {
      throw new BadRequestException('فایل باید در فضای تیکت باشد.');
    }
    return file;
  }

  private mapSummary(t: SupportTicket) {
    const user = t.user as User | undefined;
    return {
      uuid: t.uuid,
      publicId: t.publicId,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt,
      lastMessageAt: t.lastMessageAt,
      closedAt: t.closedAt,
      user: user
        ? {
            uuid: user.uuid,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email,
          }
        : null,
    };
  }

  private async mapMessage(m: SupportTicketMessage, ticketUuid: string) {
    const file = m.file as FileEntity | undefined;
    const author = m.author as User | undefined;
    let fileUrl: string | null = null;
    if (file) {
      try {
        fileUrl = await this.storageService.getPresignedUrl(
          file.bucket,
          file.objectKey,
          3600,
        );
      } catch {
        fileUrl = `/admin/tickets/${ticketUuid}/files/${file.uuid}`;
      }
    }
    return {
      uuid: m.uuid,
      body: m.body,
      isStaff: m.isStaff,
      isEdited: m.isEdited,
      editedAt: m.editedAt,
      createdAt: m.createdAt,
      author: author
        ? {
            uuid: author.uuid,
            firstName: author.firstName,
            lastName: author.lastName,
          }
        : null,
      file: file
        ? {
            uuid: file.uuid,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
            url: fileUrl,
          }
        : null,
    };
  }
}
