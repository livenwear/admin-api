import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlugService } from 'src/common/slug.service';
import { ProductAttributeValue } from 'src/database/entities/product/product-attribute-value.entity';
import { ProductAttribute } from 'src/database/entities/product/product-attribute.entity';
import { ProductCategory } from 'src/database/entities/product/product-category.entity';
import { Product } from 'src/database/entities/product/product.entity';
import { Tag } from 'src/database/entities/product/tag.entity';
import { CreateProductAdminDto, GetProductsAdminDto } from './dto';
@Injectable()
export class ProductAdminService {
  constructor(

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly slugService: SlugService,

  ) { }

async createProductByAdmin(dto: CreateProductAdminDto) {
  try {

    const slug =
      dto.slug ?? (await this.slugService.generateSlug(dto.name));

    const sku =
      dto.sku ?? `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const product = this.productRepo.create({
      ...dto,
      slug,
      sku,
      stockQuantity: dto.stockQuantity ?? 0,
      isInStock: dto.isInStock ?? true,
      allowBackorders: dto.allowBackorders ?? false,
      status: dto.status ?? 'active',
    });

    await this.productRepo.save(product);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Product created successfully',
      data: product,
    };
  } catch (error) {
    throw new InternalServerErrorException('Error creating product');
  }
}

async getProducts(query: GetProductsAdminDto) {
  const {
    uuid,
    page = 1,
    limit = 10,
    name,
    sku,
    status,
    isInStock,
    minPrice,
    maxPrice,
  } = query;

  const qb = this.productRepo
    .createQueryBuilder('product')
    .leftJoinAndSelect('product.categories', 'categories')
    // .leftJoinAndSelect('product.tags', 'tags')
    .leftJoinAndSelect('product.attributes', 'attributes')

  if (uuid) {
    const product = await qb
      .andWhere('product.uuid = :uuid', { uuid })
      .getOne();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      statusCode: 200,
      data: product,
    };
  }

  if (name) {
    qb.andWhere('product.name ILIKE :name', {
      name: `%${name}%`,
    });
  }

  if (sku) {
    qb.andWhere('product.sku = :sku', { sku });
  }

  if (status) {
    qb.andWhere('product.status = :status', { status });
  }

  if (isInStock !== undefined) {
    qb.andWhere('product.isInStock = :isInStock', { isInStock });
  }

  if (minPrice) {
    qb.andWhere('product.regularPrice >= :minPrice', { minPrice });
  }

  if (maxPrice) {
    qb.andWhere('product.regularPrice <= :maxPrice', { maxPrice });
  }

  qb.skip((page - 1) * limit).take(limit);

  const [products, total] = await qb.getManyAndCount();

  return {
    statusCode: 200,
    data: products,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}


}