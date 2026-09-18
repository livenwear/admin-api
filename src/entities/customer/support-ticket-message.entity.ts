import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'support_ticket_messages' })
export class SupportTicketMessage extends AbstractEntity {
  @ManyToOne('SupportTicket', 'messages', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: any;

  @Column({ name: 'ticket_id' })
  ticketId: number;

  @ManyToOne('User', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author: any;

  @Column({ name: 'author_id', nullable: true })
  authorId: number | null;

  @Column({ type: 'boolean', default: false })
  isStaff: boolean;

  @Column({ type: 'text' })
  body: string;

  @ManyToOne('FileEntity', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_id' })
  file: any;

  @Column({ name: 'file_id', nullable: true })
  fileId: number | null;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;
}
