import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity('product_labels')
export class ProductLabel extends AbstractEntity {
  @ManyToOne('Product', 'labels', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'varchar', nullable: true })
  colorCode: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
