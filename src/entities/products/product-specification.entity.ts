import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

/** Product-level specs (جنس، کشور سازنده، …) — separate from variant attributes */
@Entity({ name: 'product_specifications' })
export class ProductSpecification extends AbstractEntity {
  @ManyToOne('Product', 'specifications', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'varchar' })
  value: string;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;
}
