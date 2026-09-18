import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'post_tag_relations' })
@Unique(['postId', 'tagId'])
export class PostTagRelation {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Post', 'tagRelations', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: any;

  @Column({ name: 'post_id' })
  postId: number;

  @ManyToOne('PostTag', 'postRelations', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: any;

  @Column({ name: 'tag_id' })
  tagId: number;
}
