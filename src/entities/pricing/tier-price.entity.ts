import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity('tier_prices')
export class TierPrice extends AbstractEntity {
  @ManyToOne('ProductVariant', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id' })
  variantId: number;

  @Column({ type: 'int' })
  minQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', default: 'IRR' })
  currency: string;
}
