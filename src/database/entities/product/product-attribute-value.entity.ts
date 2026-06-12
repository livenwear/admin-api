import { Entity, Column, ManyToOne } from 'typeorm';
import { ProductAttribute } from './product-attribute.entity';
import { AbstractEntity } from 'src/database/common/abstract.entity';

@Entity({ name: 'product_attribute_values' })
export class ProductAttributeValue extends AbstractEntity {

  @Column({ type: 'varchar', length: 255 })
  value: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @ManyToOne(() => ProductAttribute, (attribute) => attribute.attributeValues, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  attribute: ProductAttribute;

  @Column({ type: 'varchar', length: 255, nullable: true })
  colorCode: string;

  @Column({ type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;
}
