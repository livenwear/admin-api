import { Column, Entity, OneToMany } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { DiscountType } from '../enums';

@Entity('discounts')
export class Discount extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  code: string | null;

  @Column({ type: 'enum', enum: DiscountType })
  type: DiscountType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  value: string;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @OneToMany('DiscountProduct', 'discount')
  discountProducts: any[];

  @OneToMany('DiscountCategory', 'discount')
  discountCategories: any[];

  @OneToMany('DiscountBrand', 'discount')
  discountBrands: any[];
}
