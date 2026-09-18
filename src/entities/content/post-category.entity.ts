import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'post_categories' })
export class PostCategory extends AbstractEntity {
  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 180, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

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

  @OneToMany('PostCategoryRelation', 'category')
  postRelations: any[];
}
