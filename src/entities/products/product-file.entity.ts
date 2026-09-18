import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity('product_files')
export class ProductFile extends AbstractEntity {
  @ManyToOne('Product', 'productFiles', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne('FileEntity', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: any;

  @Column({ name: 'file_id' })
  fileId: number;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;
}
