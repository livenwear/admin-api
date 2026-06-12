import { Exclude } from 'class-transformer';
import { Entity, Column, CreateDateColumn, DeleteDateColumn, Generated, PrimaryGeneratedColumn, UpdateDateColumn, ManyToMany } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { AbstractEntity } from 'src/database/common/abstract.entity';
import { Product } from './product.entity';
@Entity({ name: 'tags' })
export class Tag extends AbstractEntity {



    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    slug: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    colorCode: string;

    @Column({ type: 'integer', default: 0 })
    displayOrder: number;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'json', nullable: true })
    metadata: Record<string, any>;
    
    @ManyToMany(() => Product, (product) => product.tags)
    products: Product[];
}