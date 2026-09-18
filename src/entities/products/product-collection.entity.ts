import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('product_collections')
@Unique(['productId', 'collectionId'])
export class ProductCollection {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Product', 'productCollections', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne('Collection', undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection: any;

  @Column({ name: 'collection_id' })
  collectionId: number;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;
}
