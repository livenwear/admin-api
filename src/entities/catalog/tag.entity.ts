import {
  Column,
  Entity,
  OneToMany,
  Relation,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'tags' })
export class Tag extends AbstractEntity {
  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @OneToMany('ProductTag', 'tag')
  productTags: Relation<unknown>[];
}
