import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Relation,
} from 'typeorm';

import type { User } from '../user/user.entity';
import type { Blog } from './blog.entity';

@Entity({ name: 'comments' })
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne('User', 'comments', { eager: true, onDelete: 'CASCADE' })
  author: Relation<User>;

  @ManyToOne('Blog', 'comments', { onDelete: 'CASCADE' })
  blog: Relation<Blog>;

  @CreateDateColumn()
  createdAt: Date;
}
