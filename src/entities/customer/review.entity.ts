import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'reviews' })
export class Review extends AbstractEntity {
  @ManyToOne('User', 'reviews', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne('Product', 'reviews', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne('ProductVariant', undefined, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id', nullable: true })
  variantId: number | null;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'boolean', default: false })
  isApproved: boolean;

  /** Admin / store reply to the customer review */
  @Column({ type: 'text', nullable: true })
  adminReply: string | null;

  @Column({ name: 'replied_at', type: 'timestamptz', nullable: true })
  repliedAt: Date | null;

  @ManyToOne('User', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replied_by_user_id' })
  repliedBy: any;

  @Column({ name: 'replied_by_user_id', nullable: true })
  repliedByUserId: number | null;
}
