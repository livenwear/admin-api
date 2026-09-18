import { Injectable, NotFoundException, BadRequestException, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { SlugService } from 'src/common/slug.service';
import { ProductCategory } from 'src/entities';
import { CreateProductCategoryDto, UpdateProductCategoryDto, ProductCategoryQueryDto, BaseResponseDto } from './dto';

@Injectable()
export class ProductCategoryAdminService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
    private readonly slugService: SlugService,
  ) { }

  async createCategory(dto: CreateProductCategoryDto, req: any): Promise<{
    data: ProductCategory;
    meta: { status: number; message: string };
  }> {
    try {
      const { parentCategoryUuid, ...categoryData } = dto;
      // const baseSlug = this.slugService.generateSlug(dto.slug);

      // Create a new ProductCategory instance
      const category = this.categoryRepo.create({
        ...categoryData,
        // slug: baseSlug,
        creator: { id: req.user.id }, // Associate the creator with the new category
      });

      // Assign parent category if parentCategoryUuid is provided
      if (parentCategoryUuid) {
        const parent = await this.categoryRepo.findOne({ where: { uuid: parentCategoryUuid } });
        if (!parent) {
          throw new BadRequestException('Parent category not found.');
        }
        if (parent.uuid === category.uuid) {
          throw new BadRequestException('Category cannot be its own parent.');
        }
        category.parentCategory = parent;
      }

      // Save the new category to the database
      const savedCategory = await this.categoryRepo.save(category);

      return {
        data: savedCategory,
        meta: { status: 201, message: 'Category created successfully.' },
      };
    } catch (error) {
      // Handle different types of errors
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Log the full error for debugging in production environments
      console.error(error);
      throw new InternalServerErrorException('Failed to create category.');
    }
  }


async getAllCategories(
  query: ProductCategoryQueryDto
): Promise<
  | { data: ProductCategory; meta: null } // single
  | {
      data: ProductCategory[];
      meta: {
        totalItems: number;
        totalPages: number;
        currentPage: number;
        itemsPerPage: number;
        allItems: number;
      };
    } // paginated
> {
  const {
    page = 1,
    limit = 10,
    title,
    slug,
    description,
    primaryImageUrl,
    parentCategoryUuid,
    categoryUuid,
    subCategoryUuid,
    metaTitle,
    metaDescription,
    metaKeywords,
    displayOrder,
    isActive,
    metadata,
  } = query;

  try {
    // 👉 CASE 1: single category fetch
    if (categoryUuid) {
      const category = await this.categoryRepo.findOne({
        where: { uuid: categoryUuid },
        relations: ['parentCategory', 'subCategories',  'products'],
      });

      if (!category) {
        throw new HttpException(
          {
            status: HttpStatus.NOT_FOUND,
            message: `Category with uuid ${categoryUuid} not found`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        data: category,
        meta: null, // no pagination meta for single fetch
      };
    }

    // 👉 CASE 2: paginated query
    const where: any = {};
    if (title) where.title = Like(`%${title}%`);
    if (slug) where.slug = Like(`%${slug}%`);
    if (description) where.description = Like(`%${description}%`);
    if (primaryImageUrl) where.primaryImageUrl = Like(`%${primaryImageUrl}%`);
    if (parentCategoryUuid) where.parentCategory = { uuid: parentCategoryUuid };
    if (subCategoryUuid) where.subCategories = { uuid: subCategoryUuid };
    if (metaTitle) where.metaTitle = Like(`%${metaTitle}%`);
    if (metaDescription) where.metaDescription = Like(`%${metaDescription}%`);
    if (metaKeywords) where.metaKeywords = Like(`%${metaKeywords}%`);
    if (displayOrder !== undefined) where.displayOrder = displayOrder;
    if (isActive !== undefined) where.isActive = isActive;
    if (metadata) where.metadata = Like(`%${metadata}%`);

    const [categories, total] = await this.categoryRepo.findAndCount({
      where,
      relations: ['parentCategory', 'subCategories', 'products'],
      take: limit,
      skip: (page - 1) * limit,
    });

    const allItems = await this.categoryRepo
      .createQueryBuilder('category')
      .getCount();

    return {
      data: categories,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        itemsPerPage: limit,
        allItems,
      },
    };
  } catch (error) {
    throw new HttpException(
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch product categories',
        // error: ,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}


  // async getCategoryByUuid(uuid: string): Promise<BaseResponseDto<ProductCategory>> {
  //   const category = await this.categoryRepo.findOne({
  //     where: { uuid },
  //     relations: ['parentCategory', 'subCategories', 'attributes', 'products', 'tags'],
  //   });
  //   if (!category) {
  //     throw new NotFoundException('Category not found');
  //   }
  //   return {
  //     data: category,
  //     meta: { status: 200, message: 'Category retrieved successfully' },
  //   };
  // }

  // async getAllCategories(query: ProductCategoryQueryDto): Promise<BaseResponseDto<ProductCategory[]>> {
  //   const { page = 1, limit = 10, name, slug, description, parentCategoryUuid, metaTitle, metaDescription, metaKeywords, isActive, displayOrder } = query;
  //   const where: any = {};
  //   if (name) where.name = Like(`%${name}%`);
  //   if (slug) where.slug = Like(`%${slug}%`);
  //   if (description) where.description = Like(`%${description}%`);
  //   if (parentCategoryUuid) where.parentCategory = { uuid: parentCategoryUuid };
  //   if (metaTitle) where.metaTitle = Like(`%${metaTitle}%`);
  //   if (metaDescription) where.metaDescription = Like(`%${metaDescription}%`);
  //   if (metaKeywords) where.metaKeywords = Like(`%${metaKeywords}%`);
  //   if (isActive !== undefined) where.isActive = isActive;
  //   if (displayOrder !== undefined) where.displayOrder = displayOrder;

  //   const [categories, total] = await this.categoryRepo.findAndCount({
  //     where,
  //     relations: ['parentCategory', 'subCategories', 'attributes', 'products', 'tags'],
  //     take: limit,
  //     skip: (page - 1) * limit,
  //   });

  //   return {
  //     data: categories,
  //     meta: {
  //       status: 200,
  //       message: 'Categories retrieved successfully',
  //       pagination: {
  //         page,
  //         limit,
  //         total,
  //         totalPages: Math.ceil(total / limit),
  //       },
  //     },
  //   };
  // }

async updateCategory(dto: UpdateProductCategoryDto, req: any): Promise<BaseResponseDto<ProductCategory>> {
    const { uuid, parentCategoryUuid, ...updateData } = dto;
    const category = await this.categoryRepo.findOne({ where: { uuid } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (parentCategoryUuid) {
      const parent = await this.categoryRepo.findOne({ where: { uuid: parentCategoryUuid } });
      if (!parent) {
        throw new BadRequestException('Parent category not found.');
      }
      if (parent.uuid === category.uuid) {
        throw new BadRequestException('Category cannot be its own parent.');
      }
      Object.assign(category, {
        ...updateData,
        updater: { id: req.user.id },
        parentCategory: parent, // Assign the parent entity
      });
    } else {
      Object.assign(category, {
        ...updateData,
        updater: { id: req.user.id },
        parentCategory: null, // Clear parent if no parentCategoryUuid is provided
      });
    }

    const updatedCategory = await this.categoryRepo.save(category);
    return {
      data: updatedCategory,
      meta: { status: 200, message: 'Category updated successfully' },
    };
}

  async deleteCategory(uuid: string): Promise<BaseResponseDto<null>> {
    const category = await this.categoryRepo.findOne({ where: { uuid } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    await this.categoryRepo.softDelete({ uuid });
    return {
      data: null,
      meta: { status: 200, message: 'Category deleted successfully' },
    };
  }
}