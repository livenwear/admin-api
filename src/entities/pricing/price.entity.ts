import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'prices' })
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

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
