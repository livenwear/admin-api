import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { ChatConversationStatus } from '../enums/chat.enum';

@Entity({ name: 'chat_conversations' })
export class ChatConversation extends AbstractEntity {
  @ManyToOne('User', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @Index()
  @Column({ name: 'customer_id' })
  customerId: number;

  @Index()
  @Column({
    type: 'varchar',
    length: 16,
    default: ChatConversationStatus.OPEN,
  })
  status: ChatConversationStatus;

  @Column({ type: 'varchar', length: 160, nullable: true })
  subject: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  lastMessagePreview: string | null;

  @Column({ type: 'int', default: 0 })
  customerUnreadCount: number;

  @Column({ type: 'int', default: 0 })
  adminUnreadCount: number;

  @Column({ type: 'int', default: 0 })
  attachmentCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @OneToMany('ChatMessage', 'conversation')
  messages: any[];
}
