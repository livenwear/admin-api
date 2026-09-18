import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('coupon_categories')
@Unique(['couponId', 'categoryId'])
export class CouponCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Coupon', 'couponCategories', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'coupon_id' })
  coupon: any;

  @Column({ name: 'coupon_id' })
  couponId: number;

  @ManyToOne('Category', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: any;

  @Column({ name: 'category_id' })
  categoryId: number;
}
