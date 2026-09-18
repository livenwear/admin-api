import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'promo_cards' })
export class PromoCard extends AbstractEntity {
  @ManyToOne('PromoCardRow', 'cards', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'row_id' })
  row: any;

  @Column({ name: 'row_id' })
  rowId: number;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @ManyToOne('FileEntity', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_id' })
  file: any;

  @Column({ name: 'file_id', nullable: true })
  fileId: number | null;

  /** Custom redirect — absolute or relative storefront path */
  @Column({ type: 'varchar', nullable: true })
  linkUrl: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
