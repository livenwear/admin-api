import {
  Column,
  Entity,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'roles' })
export class Role extends AbstractEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @OneToMany('UserRoleEntity', 'role')
  userRoles: any[];

  @OneToMany('RolePermission', 'role')
  rolePermissions: any[];
}
