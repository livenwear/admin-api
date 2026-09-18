import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Links a magazine post to a storefront catalog category (auto product shelf). */
@Entity({ name: 'post_shop_categories' })
export class PostShopCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Post', 'postShopCategories', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: any;

  @Column({ name: 'post_id' })
  postId: number;

  @ManyToOne('Category', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: any;

  @Column({ name: 'category_id' })
  categoryId: number;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;
}
