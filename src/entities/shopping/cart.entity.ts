import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'carts' })
export class Cart extends AbstractEntity {
  @ManyToOne('User', 'carts', {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', nullable: true })
  guestToken: string | null;

  @OneToMany('CartItem', 'cart')
  items: any[];
}
