import {
  Column,
  Entity,
  Index,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';
import { PostStatus } from '../enums';

@Entity({ name: 'pages' })
export class Page extends AbstractEntity {
  @Column({ type: 'varchar' })
  title: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;

  @Column({ type: 'varchar', nullable: true })
  metaTitle: string | null;

  @Column({ type: 'text', nullable: true })
  metaDescription: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
