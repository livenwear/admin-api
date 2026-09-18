import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'inventories' })
@Unique(['warehouseId', 'variantId'])
export class Inventory extends AbstractEntity {
  @ManyToOne('Warehouse', 'inventories', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: any;

  @Column({ name: 'warehouse_id' })
  warehouseId: number;

  @ManyToOne('ProductVariant', 'inventories', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: any;

  @Column({ name: 'variant_id' })
  variantId: number;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  reservedQuantity: number;
}
