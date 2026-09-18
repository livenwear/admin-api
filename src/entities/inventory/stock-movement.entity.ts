import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { StockMovementType } from '../enums';

@Entity('stock_movements')
export class StockMovement extends AbstractEntity {
  @ManyToOne('Warehouse', 'stockMovements', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: any;

  @Column({ name: 'warehouse_id' })
  warehouseId: number;

  @ManyToOne('ProductVariant', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id' })
  variantId: number;

  @Column({ type: 'enum', enum: StockMovementType })
  type: StockMovementType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ type: 'int', nullable: true })
  referenceId: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne('User', undefined, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: any;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: number | null;
}
