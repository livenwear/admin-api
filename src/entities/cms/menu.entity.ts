import {
  Column,
  Entity,
  Index,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'menus' })
export class Menu extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('MenuItem', 'menu')
  items: any[];
}
