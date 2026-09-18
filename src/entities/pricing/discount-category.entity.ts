import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('discount_categories')
@Unique(['discountId', 'categoryId'])
export class DiscountCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Discount', 'discountCategories', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'discount_id' })
  discount: any;

  @Column({ name: 'discount_id' })
  discountId: number;

  @ManyToOne('Category', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: any;

  @Column({ name: 'category_id' })
  categoryId: number;
}
