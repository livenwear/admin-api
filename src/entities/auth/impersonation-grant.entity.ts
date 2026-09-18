import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'impersonation_grants' })
export class ImpersonationGrant extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  code: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser: any;

  @Column({ name: 'admin_user_id' })
  adminUserId: number;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_user_id' })
  targetUser: any;

  @Column({ name: 'target_user_id' })
  targetUserId: number;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  adminIp: string | null;

  @Column({ type: 'varchar', nullable: true })
  adminUserAgent: string | null;
}
