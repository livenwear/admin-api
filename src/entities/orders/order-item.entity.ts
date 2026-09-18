import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'order_items' })
export class OrderItem extends AbstractEntity {
  @ManyToOne('Order', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: any;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne('Product', undefined, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id', nullable: true })
  productId: number | null;

  @ManyToOne('ProductVariant', 'orderItems', {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id', nullable: true })
  variantId: number | null;

  @Column({ type: 'varchar' })
  productName: string;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalPrice: string;

  @Column({ type: 'jsonb', nullable: true })
  attributesSnapshot: Record<string, unknown> | null;
}
