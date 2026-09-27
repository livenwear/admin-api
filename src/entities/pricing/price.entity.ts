import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'prices' })
@Index(['variantId', 'effectiveFrom'])
export class Price extends AbstractEntity {
  @ManyToOne('ProductVariant', 'prices', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id' })
  variantId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  compareAtAmount: string | null;

  @Column({ type: 'varchar', default: 'IRR' })
  currency: string;

  /** Soft-void: inactive rows are ignored by effective-price resolution. */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * When this price becomes the selling price.
   * Past/present → eligible for storefront; future → scheduled.
   */
  @Column({ type: 'timestamptz', nullable: true })
  effectiveFrom: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
