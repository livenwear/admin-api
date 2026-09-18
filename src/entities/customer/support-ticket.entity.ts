import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../enums/ticket.enum';

@Entity({ name: 'support_tickets' })
export class SupportTicket extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 24, unique: true })
  publicId: string;

  @Column({ type: 'varchar' })
  subject: string;

  @Column({ type: 'varchar', length: 32, default: TicketCategory.OTHER })
  category: TicketCategory;

  @Column({ type: 'varchar', length: 16, default: TicketPriority.NORMAL })
  priority: TicketPriority;

  @Column({ type: 'varchar', length: 16, default: TicketStatus.OPEN })
  status: TicketStatus;

  @ManyToOne('User', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @OneToMany('SupportTicketMessage', 'ticket')
  messages: any[];
}
