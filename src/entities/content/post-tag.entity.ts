import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'post_tags' })
export class PostTag extends AbstractEntity {
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 140, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 220, nullable: true })
  metaTitle: string | null;

  @Column({ type: 'text', nullable: true })
  metaDescription: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @ManyToOne('FileEntity', undefined, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'image_id' })
  imageFile: any;

  @Column({ name: 'image_id', nullable: true })
  imageId: number | null;

  @OneToMany('PostTagRelation', 'tag')
  postRelations: any[];
}
