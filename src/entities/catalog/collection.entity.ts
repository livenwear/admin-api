import {
  Column,
  Entity,
  OneToMany,
  Relation,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'collections' })
export class Collection extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('ProductCollection', 'collection')
  productCollections: Relation<unknown>[];
}
