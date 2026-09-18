import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'addresses' })
export class Address extends AbstractEntity {
  @ManyToOne('User', 'addresses', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'varchar', nullable: true })
  province: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar' })
  addressLine1: string;

  @Column({ type: 'varchar', nullable: true })
  addressLine2: string | null;

  /** پلاک */
  @Column({ type: 'varchar', nullable: true })
  plaque: string | null;

  /** واحد */
  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

  @Column({ type: 'varchar', nullable: true })
  postalCode: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;
}
