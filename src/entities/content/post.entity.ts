import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { PostStatus } from '../enums';

@Entity({ name: 'posts' })
@Index(['status', 'publishedAt'])
@Index(['isFeatured', 'status'])
export class Post extends AbstractEntity {
  @Column({ type: 'varchar', length: 220 })
  title: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 240, unique: true })
  slug: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string | null;

  /** Legacy varchar cover URL — kept for sync compatibility; prefer featuredImageFile */
  @Column({ type: 'varchar', nullable: true })
  featuredImage: string | null;

  @ManyToOne('FileEntity', undefined, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'featured_image_id' })
  featuredImageFile: any;

  @Column({ name: 'featured_image_id', nullable: true })
  featuredImageId: number | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  featuredImageAlt: string | null;

  @ManyToOne('FileEntity', undefined, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'og_image_id' })
  ogImageFile: any;

  @Column({ name: 'og_image_id', nullable: true })
  ogImageId: number | null;

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;

  @ManyToOne('User', undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author: any;

  @Column({ name: 'author_id', nullable: true })
  authorId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  metaTitle: string | null;

  @Column({ type: 'text', nullable: true })
  metaDescription: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  metaKeywords: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  canonicalUrl: string | null;

  @Column({ type: 'int', default: 1 })
  readingTimeMinutes: number;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @OneToMany('Comment', 'post')
  comments: any[];

  @OneToMany('PostCategoryRelation', 'post')
  categoryRelations: any[];

  @OneToMany('PostTagRelation', 'post')
  tagRelations: any[];

  @OneToMany('PostProduct', 'post')
  postProducts: any[];

  @OneToMany('PostShopCategory', 'post')
  postShopCategories: any[];
}
