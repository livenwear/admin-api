import {
  Column,
  Entity,
  Index,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'users' })
export class User extends AbstractEntity {
  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  /** Nullable for SMS-only customers */
  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true, nullable: true })
  phone: string | null;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'varchar', nullable: true })
  twoFactorSecret: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLogin: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  resetToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resetTokenExpires: Date | null;

  @OneToMany('UserRoleEntity', 'user')
  userRoles: any[];

  @OneToMany('RefreshToken', 'user')
  refreshTokens: any[];

  @OneToMany('Address', 'user')
  addresses: any[];

  @OneToMany('Cart', 'user')
  carts: any[];

  @OneToMany('Wishlist', 'user')
  wishlists: any[];

  @OneToMany('Order', 'user')
  orders: any[];

  @OneToMany('Review', 'user')
  reviews: any[];

  @OneToMany('Notification', 'user')
  notifications: any[];

  @OneToMany('Comment', 'author')
  comments: any[];

  @OneToMany('AuditLog', 'user')
  auditLogs: any[];
}
