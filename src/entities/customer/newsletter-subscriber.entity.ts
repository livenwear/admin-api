import {
  Column,
  Entity,
  Index,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'newsletter_subscribers' })
export class NewsletterSubscriber extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  subscribedAt: Date;
}
