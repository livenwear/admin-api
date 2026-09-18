import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from 'src/entities';
import { LandPublicProvider } from './landPublic.provider';

@Injectable()
export class LandPublicService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly productRepository: Repository<ProductCategory>,
  ) {}

  async getAllCategories(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const query = this.productRepository
      .createQueryBuilder('category')
      .where('category.isActive = :isActive', { isActive: true })
      .orderBy('category.displayOrder', 'ASC')
      .skip(skip)
      .take(limit);

    const items = await query.getMany();

    const total = await this.productRepository
      .createQueryBuilder('category')
      .where('category.isActive = :isActive', { isActive: true })
      .getCount();

    const data = items.map((cat) =>
      LandPublicProvider.categoryListItem(cat),
    );

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
