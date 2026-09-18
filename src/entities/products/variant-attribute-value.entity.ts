import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'variant_attribute_values' })
@Unique(['variantId', 'attributeValueId'])
export class VariantAttributeValue {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('ProductVariant', 'variantAttributeValues', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id' })
  variantId: number;

  @ManyToOne('AttributeValue', 'variantAttributeValues', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attribute_value_id' })
  attributeValue: any;

  @Column({ name: 'attribute_value_id' })
  attributeValueId: number;
}
