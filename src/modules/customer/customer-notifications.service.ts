import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification, User } from 'src/entities';
import { Repository } from 'typeorm';

@Injectable()
export class CustomerNotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  private map(row: Notification) {
    return {
      uuid: row.uuid,
      title: row.title,
      body: row.body,
      type: row.type,
      data: row.data,
      isRead: row.isRead,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }

  async list(user: User) {
    const rows = await this.notifRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const unreadCount = rows.filter((r) => !r.isRead).length;
    return {
      success: true,
      data: {
        items: rows.map((r) => this.map(r)),
        count: rows.length,
        unreadCount,
      },
    };
  }

  async markRead(user: User, uuid: string) {
    const row = await this.notifRepo.findOne({
      where: { uuid, userId: user.id },
    });
    if (!row) throw new NotFoundException('پیام یافت نشد.');
    if (!row.isRead) {
      row.isRead = true;
      row.readAt = new Date();
      await this.notifRepo.save(row);
    }
    return { success: true, data: this.map(row) };
  }

  async markAllRead(user: User) {
    await this.notifRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('"user_id" = :userId', { userId: user.id })
      .andWhere('"isRead" = false')
      .execute();
    return this.list(user);
  }
}
