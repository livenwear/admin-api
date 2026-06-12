import { Exclude } from 'class-transformer';
import { Entity, Column, CreateDateColumn, DeleteDateColumn, Generated, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, OneToMany, ManyToMany } from 'typeorm';
import { Product } from './product.entity';
import { AbstractEntity } from 'src/database/common/abstract.entity';
import { User } from '../user/user.entity';
@Entity({ name: 'product_categories' })
export class ProductCategory extends AbstractEntity {

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  primaryImageUrl: string;

  @ManyToOne(() => ProductCategory, (category) => category.subCategories, { nullable: true, onDelete: 'SET NULL' })
  parentCategory: ProductCategory;

  @OneToMany(() => ProductCategory, (category) => category.parentCategory)
  subCategories: ProductCategory[];

  
  @Column({ type: 'varchar', length: 255, nullable: true })
  metaTitle: string;

  @Column({ type: 'text', nullable: true })
  metaDescription: string;

  @Column({ type: 'text', nullable: true })
  metaKeywords: string;

  @Column({ type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToMany(() => Product, (product) => product.categories)
  products: Product[];


  @ManyToOne(() => User, (user) => user.productCategoriesCreator, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  creator: User;

  @ManyToOne(() => User, (user) => user.productCategoriesUpdater, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  updater: User;
}