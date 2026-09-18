import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'post_category_relations' })
@Unique(['postId', 'categoryId'])
export class PostCategoryRelation {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Post', 'categoryRelations', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_id' })
  post: any;

  @Column({ name: 'post_id' })
  postId: number;

  @ManyToOne('PostCategory', 'postRelations', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: any;

  @Column({ name: 'category_id' })
  categoryId: number;
}
