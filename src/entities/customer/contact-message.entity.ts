import {
  Column,
  Entity,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'contact_messages' })
export class ContactMessage extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;
}
