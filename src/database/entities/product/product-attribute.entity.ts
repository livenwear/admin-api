import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  Relation,
} from 'typeorm';
import { AbstractEntity } from 'src/database/common/abstract.entity';

import type { Product } from './product.entity';
import type { ProductAttributeValue } from './product-attribute-value.entity';

@Entity({ name: 'product_attributes' })
export class ProductAttribute extends AbstractEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @ManyToOne('Product', 'attributes', {
    nullable: false,
    onDelete: 'CASCADE',
  })
  product: Relation<Product>;

  @OneToMany('ProductAttributeValue', 'attribute')
  attributeValues: Relation<ProductAttributeValue[]>;

  @Column({ type: 'varchar', length: 50, default: 'text' })
  attributeType: 'text' | 'select' | 'multiselect' | 'number' | 'boolean';

  @Column({ type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ type: 'boolean', default: true })
  isFilterable: boolean;

  @Column({ type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;
}
