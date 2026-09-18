import { Column, Entity, OneToMany } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity('warehouses')
export class Warehouse extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @OneToMany('Inventory', 'warehouse')
  inventories: any[];

  @OneToMany('StockMovement', 'warehouse')
  stockMovements: any[];
}
