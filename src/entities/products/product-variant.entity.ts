import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'product_variants' })
export class ProductVariant extends AbstractEntity {
  @ManyToOne('Product', 'variants', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ type: 'varchar', unique: true })
  sku: string;

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  weight: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  length: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  width: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  height: string | null;

  @OneToMany('VariantAttributeValue', 'variant')
  variantAttributeValues: any[];

  @OneToMany('Price', 'variant')
  prices: any[];

  @OneToMany('Inventory', 'variant')
  inventories: any[];

  @OneToMany('ProductImage', 'variant')
  images: any[];

  @OneToMany('CartItem', 'variant')
  cartItems: any[];

  @OneToMany('OrderItem', 'variant')
  orderItems: any[];
}
