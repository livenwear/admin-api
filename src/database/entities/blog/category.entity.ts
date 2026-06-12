import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Blog } from './blog.entity';
import { AbstractEntity } from 'src/database/common/abstract.entity';

@Entity({ name: 'blog_categories' })
export class BlogCategory extends AbstractEntity {


  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;
  
  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @ManyToMany(() => Blog, (blog) => blog.categories)
  blogs: Blog[];
}
