import { Exclude } from 'class-transformer';
import { Entity, Column, CreateDateColumn, DeleteDateColumn, Generated, PrimaryGeneratedColumn, UpdateDateColumn, ManyToMany, JoinTable, OneToMany, ManyToOne } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { AbstractEntity } from 'src/database/common/abstract.entity';
import { Tag } from './tag.entity';

import { ProductAttribute } from './product-attribute.entity';
import { Brand } from './brand.entity';


@Entity({ name: 'products' })
export class Product extends AbstractEntity {

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  shortDescription: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  regularPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salePrice: number;

  @Column({ type: 'integer', default: 0 })
  stockQuantity: number;

  @Column({ type: 'boolean', default: true })
  isInStock: boolean;

  @Column({ type: 'boolean', default: false })
  allowBackorders: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  primaryImageUrl: string;

  @Column({ type: 'json', nullable: true })
  additionalImages: string[];

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  weight: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  length: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  width: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  height: number;

  @Column({ type: 'boolean', default: false })
  isDigital: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  downloadUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  metaTitle: string;

  @Column({ type: 'text', nullable: true })
  metaDescription: string;

  @Column({ type: 'text', nullable: true })
  metaKeywords: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'draft' | 'archived';

  @Column({ type: 'integer', default: 0 })
  viewCount: number;

  @Column({ type: 'integer', default: 0 })
  salesCount: number;

@ManyToOne(() => Brand, (brand) => brand.products, { nullable: true })
brand: Brand;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToMany(() => ProductCategory, (category) => category.products)
  @JoinTable()
  categories: ProductCategory[];


  @ManyToMany(() => Tag, (tag: Tag) => tag.products)
  tags: Tag[];

  @OneToMany(() => ProductAttribute, (attribute) => attribute.product)
attributes: ProductAttribute[];
}