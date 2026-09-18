import { Column, Entity, OneToMany } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { AttributeType } from '../enums';

@Entity({ name: 'attributes' })
export class Attribute extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({
    type: 'enum',
    enum: AttributeType,
    default: AttributeType.SELECT,
  })
  type: AttributeType;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isFilterable: boolean;

  @Column({ type: 'boolean', default: true })
  isVisible: boolean;

  /** If false, storefront shows the attribute as fixed (not customer-selectable). */
  @Column({ type: 'boolean', default: true })
  isCustomerSelectable: boolean;

  @OneToMany('AttributeValue', 'attribute')
  values: any[];
}
