import { Column, Entity, Index, OneToMany, Relation } from 'typeorm';
import { AbstractEntity } from '../../common/abstract.entity';
import { UserRole } from 'src/common/type';

import type { Comment } from '../blog/comment.entity';
import type { Blog } from '../blog/blog.entity';
import type { ProductCategory } from '../product/product-category.entity';

@Entity({ name: 'users' })
export class User extends AbstractEntity {
  @Column({ type: 'varchar', length: 50 })
  firstName: string;

  @Column({ type: 'varchar', length: 50 })
  lastName: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  phone?: string;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  twoFactorSecret?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin?: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resetToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpires?: Date;

  @OneToMany('Comment', 'author')
  comments: Relation<Comment[]>;

  @OneToMany('Blog', 'author')
  blogs: Relation<Blog[]>;

  @OneToMany('ProductCategory', 'creator')
  productCategoriesCreator: Relation<ProductCategory[]>;


  @OneToMany('ProductCategory', 'updater')
  productCategoriesUpdater: Relation<ProductCategory[]>;
}





