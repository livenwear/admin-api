import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'wishlist_items' })
@Unique(['wishlistId', 'productId', 'variantId'])
export class WishlistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Wishlist', 'items', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wishlist_id' })
  wishlist: any;

  @Column({ name: 'wishlist_id' })
  wishlistId: number;

  @ManyToOne('Product', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne('ProductVariant', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id', nullable: true })
  variantId: number | null;
}
