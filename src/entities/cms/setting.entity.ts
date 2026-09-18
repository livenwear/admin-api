import {
  Column,
  Entity,
  Index,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'settings' })
export class Setting extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', nullable: true })
  group: string | null;

  @Column({ type: 'varchar', default: 'string' })
  type: string;
}
