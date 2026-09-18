import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'user_roles' })
@Unique(['userId', 'roleId'])
export class UserRoleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('User', 'userRoles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne('Role', 'userRoles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: any;

  @Column({ name: 'role_id' })
  roleId: number;
}
