import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'post_products' })
export class PostProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Post', 'postProducts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: any;

  @Column({ name: 'post_id' })
  postId: number;

  @ManyToOne('Product', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;
}
