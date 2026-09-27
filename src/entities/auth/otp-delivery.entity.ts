import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { OtpChannel, OtpPurpose } from '../enums/otp.enum';

@Entity({ name: 'otp_deliveries' })
@Index(['destination', 'createdAt'])
@Index(['userId', 'createdAt'])
export class OtpDelivery extends AbstractEntity {
  /** Phone or email the code was sent to */
  @Column({ type: 'varchar', length: 191 })
  destination: string;

  @Column({ type: 'varchar', length: 16, default: OtpChannel.SMS })
  channel: OtpChannel;

  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'varchar', length: 32, default: OtpPurpose.LOGIN })
  purpose: OtpPurpose;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id', nullable: true })
  userId: number | null;
}
