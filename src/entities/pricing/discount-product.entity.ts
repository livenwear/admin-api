import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('discount_products')
@Unique(['discountId', 'productId'])
export class DiscountProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Discount', 'discountProducts', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'discount_id' })
  discount: any;

  @Column({ name: 'discount_id' })
  discountId: number;

  @ManyToOne('Product', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;
}
