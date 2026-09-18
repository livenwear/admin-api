import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'categories' })
export class Category extends AbstractEntity {
  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  /**
   * Short public storefront id (e.g. lvc_K7H2M9QX).
   * Used in customer URLs instead of UUID.
   */
  @Column({ type: 'varchar', length: 24, unique: true, nullable: true })
  publicId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  /**
   * Category cover / hero photo (raster) as file://{uuid}.
   * Separate from SVG logo in imageUrl.
   */
  @Column({ type: 'varchar', nullable: true })
  coverImageUrl: string | null;

  @ManyToOne('Category', 'children', {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: any;

  @OneToMany('Category', 'parent')
  children: any[];

  @Column({ type: 'varchar', nullable: true })
  metaTitle: string | null;

  @Column({ type: 'text', nullable: true })
  metaDescription: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('ProductCategory', 'category')
  productCategories: any[];
}
