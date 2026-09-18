import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FileEntity,
  SupportTicket,
  SupportTicketMessage,
  TicketPriority,
  TicketStatus,
  User,
} from 'src/entities';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { Repository } from 'typeorm';
import { CreateTicketDto, ReplyTicketDto } from './dto/ticket.dto';

@Injectable()
export class CustomerTicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage)
    private readonly messageRepo: Repository<SupportTicketMessage>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly storageService: StorageService,
  ) {}

  async list(user: User) {
    const rows = await this.ticketRepo.find({
      where: { userId: user.id },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });
    return {
      success: true,
      data: rows.map((t) => this.mapSummary(t)),
    };
  }

  async get(user: User, key: string) {
    const ticket = await this.findOwned(user, key);
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

  async create(user: User, dto: CreateTicketDto) {
    const file = dto.fileUuid
      ? await this.resolveTicketFile(dto.fileUuid)
      : null;

    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({
        publicId: await this.allocatePublicId(),
        subject: dto.subject.trim(),
        category: dto.category,
        priority: dto.priority || TicketPriority.NORMAL,
        status: TicketStatus.OPEN,
        user,
        lastMessageAt: new Date(),
        closedAt: null,
      }),
    );

    await this.messageRepo.save(
      this.messageRepo.create({
        ticket,
        author: user,
        isStaff: false,
        body: dto.body.trim(),
        file: file || null,
        isEdited: false,
        editedAt: null,
      }),
    );

    return this.get(user, ticket.uuid);
  }

  async reply(user: User, key: string, dto: ReplyTicketDto) {
    const ticket = await this.findOwned(user, key);
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException(
        'این تیکت بسته شده است. تیکت جدید باز کنید.',
      );
    }
    const file = dto.fileUuid
      ? await this.resolveTicketFile(dto.fileUuid)
      : null;

    await this.messageRepo.save(
      this.messageRepo.create({
        ticket,
        author: user,
        isStaff: false,
        body: dto.body.trim(),
        file: file || null,
        isEdited: false,
        editedAt: null,
      }),
    );

    ticket.lastMessageAt = new Date();
    if (
      ticket.status === TicketStatus.ANSWERED ||
      ticket.status === TicketStatus.PENDING
    ) {
      ticket.status = TicketStatus.OPEN;
    }
    await this.ticketRepo.save(ticket);
    return this.get(user, ticket.uuid);
  }

  async getFileMeta(user: User, key: string, fileUuid: string) {
    const ticket = await this.findOwned(user, key);
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

  private async findOwned(user: User, key: string) {
    const ticket = await this.ticketRepo.findOne({
      where: [{ uuid: key }, { publicId: key }],
      relations: ['user'],
    });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    if (ticket.userId !== user.id) {
      throw new ForbiddenException('دسترسی به این تیکت ندارید.');
    }
    return ticket;
  }

  private async resolveTicketFile(fileUuid: string) {
    const file = await this.fileRepo.findOne({ where: { uuid: fileUuid } });
    if (!file) throw new NotFoundException('فایل پیدا نشد.');
    if (file.namespace !== StorageNamespace.TICKETS) {
      throw new BadRequestException('فایل باید در فضای تیکت باشد.');
    }
    return file;
  }

  private async allocatePublicId() {
    for (let i = 0; i < 12; i++) {
      const candidate = `tkt_${Math.random().toString(36).slice(2, 8)}`;
      const exists = await this.ticketRepo.findOne({
        where: { publicId: candidate },
      });
      if (!exists) return candidate;
    }
    return `tkt_${Date.now().toString(36)}`;
  }

  private mapSummary(t: SupportTicket) {
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
    };
  }

  private async mapMessage(m: SupportTicketMessage, ticketUuid: string) {
    const file = m.file as FileEntity | undefined;
    const author = m.author as User | undefined;
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
            url: `/customer/tickets/${ticketUuid}/files/${file.uuid}`,
          }
        : null,
    };
  }
}
