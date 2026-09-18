import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { OrderStatus, PaymentStatus } from '../enums';

@Entity({ name: 'orders' })
export class Order extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  orderNumber: string;

  @ManyToOne('User', 'orders', {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id', nullable: true })
  userId: number | null;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: string;

  @Column({ type: 'varchar', default: 'IRR' })
  currency: string;

  @Column({ type: 'jsonb' })
  shippingAddress: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  billingAddress: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** tipax | post | courier */
  @Column({ type: 'varchar', nullable: true })
  shippingMethodCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  shippingMethodTitle: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany('OrderItem', 'order')
  items: any[];

  @OneToMany('Payment', 'order')
  payments: any[];

  @OneToMany('Shipment', 'order')
  shipments: any[];

  @OneToMany('Invoice', 'order')
  invoices: any[];
}
