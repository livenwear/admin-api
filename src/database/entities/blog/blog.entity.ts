import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  Relation,
} from 'typeorm';
import { BlogCategory } from './category.entity';
import { Comment } from './comment.entity';
import { BlogStatus } from 'src/constant';
import { AbstractEntity } from 'src/database/common/abstract.entity';
import { Tag } from './tag.entity';
import { User } from '../user/user.entity';

@Entity({ name: 'blogs' })
export class Blog extends AbstractEntity {
  @Column({ type: 'varchar', length: 255 })
  @Index({ fulltext: true })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'text' })
  @Index({ fulltext: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  excerpt?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  featuredImage?: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  metaTitle?: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  metaDescription?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  metaKeywords?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  publishedAt?: Date;

  @Column({
    type: 'enum',
    enum: BlogStatus,
    default: BlogStatus.DRAFT,
  })
  status: BlogStatus;

  @ManyToOne(() => User, (user) => user.blogs, { eager: true })
  author: Relation<User>;

  @Column({ type: 'int', default: 0 })
  priority?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  canonicalUrl?: string;

  @ManyToMany(() => BlogCategory, (category) => category.blogs, { eager: true })
  @JoinTable()
  categories: Relation<BlogCategory[]>;

  @ManyToMany(() => Tag, (tag) => tag.blogs, { eager: true })
  @JoinTable()
  tags: Relation<Tag[]>;

  @OneToMany(() => Comment, (comment) => comment.blog)
  comments: Relation<Comment[]>;
}
