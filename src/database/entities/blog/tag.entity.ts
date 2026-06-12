import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Blog } from './blog.entity';
import { AbstractEntity } from 'src/database/common/abstract.entity';

@Entity({ name: 'tags' })
export class Tag extends AbstractEntity {

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @ManyToMany(() => Blog, (blog) => blog.tags)
  blogs: Blog[];
}
