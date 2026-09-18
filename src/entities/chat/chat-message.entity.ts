import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { ChatMessageStatus, ChatSenderRole } from '../enums/chat.enum';

@Entity({ name: 'chat_messages' })
export class ChatMessage extends AbstractEntity {
  @ManyToOne('ChatConversation', 'messages', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: any;

  @Index()
  @Column({ name: 'conversation_id' })
  conversationId: number;

  @ManyToOne('User', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_id' })
  sender: any;

  @Column({ name: 'sender_id', nullable: true })
  senderId: number | null;

  @Column({ type: 'varchar', length: 16 })
  senderRole: ChatSenderRole;

  @Column({ type: 'text', default: '' })
  body: string;

  @ManyToOne('FileEntity', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_id' })
  file: any;

  @Column({ name: 'file_id', nullable: true })
  fileId: number | null;

  /** Reply-to parent (same conversation only) */
  @ManyToOne('ChatMessage', undefined, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reply_to_message_id' })
  replyTo: ChatMessage | null;

  @Index()
  @Column({ name: 'reply_to_message_id', nullable: true })
  replyToMessageId: number | null;

  /** Client-generated UUID — UNIQUE for idempotent send */
  @Index({ unique: true })
  @Column({ type: 'uuid', unique: true })
  clientMsgId: string;

  @Column({ type: 'varchar', length: 16, default: ChatMessageStatus.SENT })
  status: ChatMessageStatus;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;
}
