import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { ShipmentStatus } from '../enums';

@Entity({ name: 'shipments' })
export class Shipment extends AbstractEntity {
  @ManyToOne('Order', 'shipments', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: any;

  @Column({ name: 'order_id' })
  orderId: number;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    default: ShipmentStatus.PENDING,
  })
  status: ShipmentStatus;

  @Column({ type: 'varchar', nullable: true })
  carrier: string | null;

  @Column({ type: 'varchar', nullable: true })
  trackingNumber: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  shippedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  address: Record<string, unknown> | null;
}
