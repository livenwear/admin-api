import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'menu_items' })
export class MenuItem extends AbstractEntity {
  @ManyToOne('Menu', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_id' })
  menu: any;

  @Column({ name: 'menu_id' })
  menuId: number;

  @ManyToOne('MenuItem', 'children', {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: any;

  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', nullable: true })
  url: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('MenuItem', 'parent')
  children: any[];
}
