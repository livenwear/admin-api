import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'comments' })
export class Comment extends AbstractEntity {
  @Column({ type: 'text' })
  content: string;

  @ManyToOne('Post', 'comments', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: any;

  @Column({ name: 'post_id' })
  postId: number;

  @ManyToOne('User', 'comments')
  @JoinColumn({ name: 'author_id' })
  author: any;

  @Column({ name: 'author_id' })
  authorId: number;

  @ManyToOne('Comment', 'replies', {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: any;

  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null;

  @OneToMany('Comment', 'parent')
  replies: any[];

  @Column({ type: 'boolean', default: false })
  isApproved: boolean;
}
