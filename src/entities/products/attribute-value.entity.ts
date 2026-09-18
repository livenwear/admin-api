import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'attribute_values' })
export class AttributeValue extends AbstractEntity {
  @ManyToOne('Attribute', 'values', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attribute_id' })
  attribute: any;

  @Column({ name: 'attribute_id' })
  attributeId: number;

  @Column({ type: 'varchar' })
  value: string;

  @Column({ type: 'varchar' })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  colorCode: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @OneToMany('VariantAttributeValue', 'attributeValue')
  variantAttributeValues: any[];
}
