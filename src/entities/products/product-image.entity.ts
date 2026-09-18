import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity('product_images')
export class ProductImage extends AbstractEntity {
  @ManyToOne('Product', 'images', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne('ProductVariant', 'images', {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id', nullable: true })
  variantId: number | null;

  @ManyToOne('FileEntity', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: any;

  @Column({ name: 'file_id' })
  fileId: number;

  @Column({ type: 'varchar', nullable: true })
  altText: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;
}
