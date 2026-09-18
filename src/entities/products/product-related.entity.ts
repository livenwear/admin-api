import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity('product_related')
@Unique(['productId', 'relatedProductId'])
export class ProductRelated extends AbstractEntity {
  @ManyToOne('Product', 'relatedFrom', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne('Product', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'related_product_id' })
  relatedProduct: any;

  @Column({ name: 'related_product_id' })
  relatedProductId: number;

  @Column({ type: 'varchar', default: 'related' })
  relationType: string;
}
