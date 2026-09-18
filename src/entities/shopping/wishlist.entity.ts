import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'wishlists' })
export class Wishlist extends AbstractEntity {
  @ManyToOne('User', 'wishlists', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', nullable: true, default: 'default' })
  name: string | null;

  @OneToMany('WishlistItem', 'wishlist')
  items: any[];
}
