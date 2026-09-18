import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'cart_items' })
@Unique(['cartId', 'variantId'])
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Cart', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: any;

  @Column({ name: 'cart_id' })
  cartId: number;

  @ManyToOne('ProductVariant', 'cartItems', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id' })
  variantId: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;
}
