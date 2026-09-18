import {
  Column,
  Entity,
  Index,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'sliders' })
export class Slider extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('SliderItem', 'slider')
  items: any[];
}
