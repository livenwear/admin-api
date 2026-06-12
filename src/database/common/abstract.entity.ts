import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn, DeleteDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class AbstractEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  public id: number;

  @Column()
  @Generated('uuid')
  public uuid: string;

  @CreateDateColumn({ type: 'timestamptz' })
  @Exclude()
  public createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  @Exclude()
  public updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true})
  @Exclude()
  public deletedAt: Date;
}