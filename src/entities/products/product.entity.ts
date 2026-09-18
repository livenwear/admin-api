import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { ProductStatus, ProductType } from '../enums';

@Entity({ name: 'products' })
export class Product extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  /**
   * Short public storefront id (e.g. lvn_K7H2M9QX).
   * Used in customer URLs instead of UUID.
   */
  @Column({ type: 'varchar', length: 24, unique: true, nullable: true })
  publicId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Editorial expert review — بررسی تخصصی */
  @Column({ type: 'text', nullable: true })
  expertReview: string | null;

  @Column({ type: 'varchar', nullable: true })
  shortDescription: string | null;

  @ManyToOne('Brand', 'products', { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: any;

  @Column({ name: 'brand_id', nullable: true })
  brandId: number | null;

  @Column({
    type: 'enum',
    enum: ProductType,
    default: ProductType.VARIABLE,
  })
  type: ProductType;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  @Column({ type: 'varchar', nullable: true })
  metaTitle: string | null;

  @Column({ type: 'text', nullable: true })
  metaDescription: string | null;

  @Column({ type: 'varchar', nullable: true })
  metaKeywords: string | null;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  /** Special-offer / شگفت‌انگیز flag — toggled in admin */
  @Column({ type: 'boolean', default: false })
  isAmazing: boolean;

  /**
   * Sales tag: product marked unavailable for checkout/payment.
   * Independent of warehouse inventory — prices still show; cart still works.
   */
  @Column({ type: 'boolean', default: false })
  isUnavailable: boolean;

  /** Denormalized rating (0–5); live reviews override when approved exist */
  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  ratingAvg: string;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @OneToMany('ProductVariant', 'product')
  variants: any[];

  @OneToMany('ProductImage', 'product')
  images: any[];

  @OneToMany('ProductCategory', 'product')
  productCategories: any[];

  @OneToMany('ProductTag', 'product')
  productTags: any[];

  @OneToMany('ProductCollection', 'product')
  productCollections: any[];

  @OneToMany('ProductFile', 'product')
  productFiles: any[];

  @OneToMany('ProductRelated', 'product')
  relatedFrom: any[];

  @OneToMany('ProductLabel', 'product')
  labels: any[];

  @OneToMany('ProductSpecification', 'product')
  specifications: any[];

  @OneToMany('Review', 'product')
  reviews: any[];
}
