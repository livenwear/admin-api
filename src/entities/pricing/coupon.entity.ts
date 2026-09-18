import { Column, Entity, OneToMany } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { DiscountType } from '../enums';

@Entity('coupons')
export class Coupon extends AbstractEntity {
  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'enum', enum: DiscountType })
  type: DiscountType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  value: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  minOrderAmount: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxDiscountAmount: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('CouponProduct', 'coupon')
  couponProducts: any[];

  @OneToMany('CouponCategory', 'coupon')
  couponCategories: any[];
}
