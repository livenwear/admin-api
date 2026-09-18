import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('product_tags')
@Unique(['productId', 'tagId'])
export class ProductTag {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Product', 'productTags', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne('Tag', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: any;

  @Column({ name: 'tag_id' })
  tagId: number;
}
