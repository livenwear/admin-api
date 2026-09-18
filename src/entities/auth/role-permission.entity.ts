import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'role_permissions' })
@Unique(['roleId', 'permissionId'])
export class RolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('Role', 'rolePermissions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: any;

  @Column({ name: 'role_id' })
  roleId: number;

  @ManyToOne('Permission', 'rolePermissions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: any;

  @Column({ name: 'permission_id' })
  permissionId: number;
}
