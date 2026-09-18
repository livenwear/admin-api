import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('discount_brands')
@Unique(['discountId', 'brandId'])
export class DiscountBrand {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Discount', 'discountBrands', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'discount_id' })
  discount: any;

  @Column({ name: 'discount_id' })
  discountId: number;

  @ManyToOne('Brand', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: any;

  @Column({ name: 'brand_id' })
  brandId: number;
}
