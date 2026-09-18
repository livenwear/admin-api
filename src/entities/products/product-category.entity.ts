import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('product_categories')
@Unique(['productId', 'categoryId'])
export class ProductCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Product', 'productCategories', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne('Category', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: any;

  @Column({ name: 'category_id' })
  categoryId: number;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;
}
