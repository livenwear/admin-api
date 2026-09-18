import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'slider_items' })
export class SliderItem extends AbstractEntity {
  @ManyToOne('Slider', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'slider_id' })
  slider: any;

  @Column({ name: 'slider_id' })
  sliderId: number;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'varchar', nullable: true })
  subtitle: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @ManyToOne('FileEntity', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_id' })
  file: any;

  @Column({ name: 'file_id', nullable: true })
  fileId: number | null;

  @Column({ type: 'varchar', nullable: true })
  linkUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  buttonText: string | null;

  @Column({ type: 'varchar', nullable: true })
  textColor: string | null;

  @Column({ type: 'varchar', nullable: true })
  overlayColor: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
