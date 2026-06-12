import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SlugService } from 'src/common/slug.service';
import { BlogStatus } from 'src/constant';
import { User } from 'src/database/entities/user/user.entity';
import { Blog } from 'src/database/entities/blog/blog.entity';
import { BlogAdminProvider } from './blog.provider';
import { FetchAllBlogsDto } from './dto/fetch-all-blogs.dto';
import { AddCategoryDto, CreateBlogDto, CreateBlogResponseDto, CreateSingleBlogDto, GetBlogsQueryDto, GetBlogsResponseDto, RemoveCategoryDto, UpdateBlogDto, UpdateBlogResponseDto } from './dto';
import { ProductCategory } from 'src/database/entities/product/product-category.entity';
import { Tag } from 'src/database/entities/blog/tag.entity';




@Injectable()
export class BlogAdminService {
  constructor(
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly slugService: SlugService,
  ) { }

//   async createBlogByAdmin(createBlogDto: CreateBlogDto, adminId: string): Promise<CreateBlogResponseDto> {
//     const queryRunner = this.blogRepository.manager.connection.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       const admin = await this.userRepository.findOne({ where: { id: Number(adminId) } });
//       if (!admin) {
//         throw new NotFoundException('Admin user not found');
//       }

//       const existingBlog = await this.blogRepository.findOne({ where: { slug: createBlogDto.slug } });
//       if (existingBlog) {
//         throw new BadRequestException('Slug already in use');
//       }

//       let categories: ProductCategory[] = [];
//       if (createBlogDto.categoryIds && createBlogDto.categoryIds.length > 0) {
//         categories = await queryRunner.manager.find(ProductCategory, {
//           where: { uuid: In(createBlogDto.categoryIds) },
//         });
//         if (categories.length !== createBlogDto.categoryIds.length) {
//           throw new NotFoundException('One or more categories not found');
//         }
//       }

//       let tags: Tag[] = [];
//       if (createBlogDto.tagIds && createBlogDto.tagIds.length > 0) {
//         tags = await queryRunner.manager.find(Tag, {
//           where: { uuid: In(createBlogDto.tagIds) },
//         });
//         if (tags.length !== createBlogDto.tagIds.length) {
//           throw new NotFoundException('One or more tags not found');
//         }
//       }

//       const blog = this.blogRepository.create({
//         ...createBlogDto,
//         categories,
//         tags,
//         author: admin,
//         status: createBlogDto.status || BlogStatus.DRAFT,
//         publishedAt: createBlogDto.status === BlogStatus.PUBLISHED ? new Date() : undefined,
//         priority: createBlogDto.priority ?? 0,
//       });

//       const savedBlog = await queryRunner.manager.save(Blog, blog);
//       await queryRunner.commitTransaction();

//       const createdBlog: CreateSingleBlogDto = BlogAdminProvider.toCreateBlog(savedBlog);

//       const response: CreateBlogResponseDto = {
//         data: createdBlog,
//         statusCode: HttpStatus.CREATED,
//       };

//       return response;

//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       if (error instanceof NotFoundException || error instanceof BadRequestException) {
//         throw error;
//       }
//       throw new InternalServerErrorException(`Failed to create blog: ${error.message}`);
//     } finally {
//       await queryRunner.release();
//     }
//   }
//   async getAllBlogs(query: GetBlogsQueryDto): Promise<GetBlogsResponseDto> {
//     const {
//       page = 1,
//       limit = 20,
//       sortBy = 'createdAt',
//       sortOrder = 'DESC',
//       title,
//       slug,
//       status,
//       authorId,
//       publishedAtFrom,
//       publishedAtTo,
//       priority,
//       categoryIds,
//       tagIds,
//       ...otherFilters
//     } = query;

//     try {
//       const totalItem = await this.blogRepository.count();

//       const queryBuilder = this.blogRepository
//         .createQueryBuilder('blog')
//         .leftJoinAndSelect('blog.author', 'author')
//         .leftJoinAndSelect('blog.categories', 'category')
//         .leftJoinAndSelect('blog.tags', 'tag')
//         .where('1=1');

//       // Title
//       if (title) {
//         queryBuilder.andWhere('blog.title ILIKE :title', { title: `%${title}%` });
//       }

//       // Slug
//       if (slug) {
//         queryBuilder.andWhere('blog.slug ILIKE :slug', { slug: `%${slug}%` });
//       }

//       // Status (comma separated)
//       if (status) {
//         const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
//         if (statuses.length > 0) {
//           queryBuilder.andWhere('blog.status IN (:...statuses)', { statuses });
//         }
//       }

//       // Author
//       if (authorId) {
//         queryBuilder.andWhere('author.id = :authorId', { authorId });
//       }

//       // Published date range
//       if (publishedAtFrom && publishedAtTo) {
//         queryBuilder.andWhere('blog.publishedAt BETWEEN :publishedAtFrom AND :publishedAtTo', {
//           publishedAtFrom,
//           publishedAtTo,
//         });
//       } else if (publishedAtFrom) {
//         queryBuilder.andWhere('blog.publishedAt >= :publishedAtFrom', { publishedAtFrom });
//       } else if (publishedAtTo) {
//         queryBuilder.andWhere('blog.publishedAt <= :publishedAtTo', { publishedAtTo });
//       }

//       // Priority
//       if (priority) {
//         queryBuilder.andWhere('blog.priority = :priority', { priority });
//       }

//       // Categories filter (UUIDs)
//       if (categoryIds) {
//         const catIds = categoryIds
//           .split(',')
//           .map(id => id.trim())
//           .filter(id => id && /^[0-9a-fA-F-]{36}$/.test(id));

//         if (catIds.length > 0) {
//           queryBuilder.andWhere('category.uuid IN (:...catIds)', { catIds });
//         }
//       }

//       // Tags filter (UUIDs)
//       if (tagIds) {
//         const tIds = tagIds
//           .split(',')
//           .map(id => id.trim())
//           .filter(id => id && /^[0-9a-fA-F-]{36}$/.test(id));

//         if (tIds.length > 0) {
//           queryBuilder.andWhere('tag.id IN (:...tIds)', { tIds });
//         }
//       }

//       // SEO-related filters
//       Object.entries(otherFilters).forEach(([key, value]) => {
//         if ([
//           'metaTitle',
//           'metaDescription',
//           'metaKeywords',
//           'excerpt',
//           'featuredImage',
//           'canonicalUrl',
//         ].includes(key) && value) {
//           queryBuilder.andWhere(`blog.${key} ILIKE :${key}`, { [key]: `%${value}%` });
//         }
//       });

//       // Sorting
//       const validSortFields = [
//         'id',
//         'title',
//         'slug',
//         'status',
//         'publishedAt',
//         'priority',
//         'createdAt',
//         'updatedAt',
//       ];
//       const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
//       const finalSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

//       queryBuilder.orderBy(`blog.${finalSortBy}`, finalSortOrder);

//       // Pagination
//       const skip = (page - 1) * limit;
//       queryBuilder.skip(skip).take(limit);

//       // Debug SQL
//       console.log('Generated SQL:', queryBuilder.getSql());

//       // Execute query
//       const [blogs, total] = await queryBuilder.getManyAndCount();
// console.log("blogs++++>", blogs)
//       const blogRetrieved = blogs.map(blog => BlogAdminProvider.toBlogListItem(blog));

//       return {
//         data: blogRetrieved,
//         statusCode: HttpStatus.OK,
//         meta: {
//           total,
//           page,
//           limit,
//           totalPages: Math.ceil(total / limit),
//           totalItem,
//         },
//       };
//     } catch (error) {
//       console.error('Error details:', error);
//       throw new InternalServerErrorException(`Failed to fetch blogs: ${error.message}`);
//     }
//   }
//   async updateBlogByAdmin(uuid: string, updateBlogDto: UpdateBlogDto, adminId: string): Promise<UpdateBlogResponseDto> {
//     const queryRunner = this.blogRepository.manager.connection.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       const admin = await this.userRepository.findOne({ where: { id: Number(adminId) } });
//       if (!admin) {
//         throw new NotFoundException('Admin user not found');
//       }

//       const blog = await this.blogRepository.findOne({
//         where: { uuid },
//         relations: ['author', 'categories', 'tags'],
//       });
//       if (!blog) {
//         throw new NotFoundException('Blog not found');
//       }

//       if (updateBlogDto.slug && updateBlogDto.slug !== blog.slug) {
//         const existingBlog = await this.blogRepository.findOne({ where: { slug: updateBlogDto.slug } });
//         if (existingBlog) {
//           throw new BadRequestException('Slug already in use');
//         }
//       }

//       // Update fields
//       Object.assign(blog, {
//         ...updateBlogDto,
//         publishedAt: updateBlogDto.status === BlogStatus.PUBLISHED && !blog.publishedAt ? new Date() : updateBlogDto.publishedAt,
//       });

//       const updatedBlog = await queryRunner.manager.save(Blog, blog);
//       await queryRunner.commitTransaction();

//       const updatedBlogDto: CreateSingleBlogDto = BlogAdminProvider.toCreateBlog(updatedBlog);

//       const response: UpdateBlogResponseDto = {
//         data: updatedBlogDto,
//         statusCode: HttpStatus.OK,
//       };

//       return response;
//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       if (error instanceof NotFoundException || error instanceof BadRequestException) {
//         throw error;
//       }
//       throw new InternalServerErrorException(`Failed to update blog: ${error.message}`);
//     } finally {
//       await queryRunner.release();
//     }
//   }

//   async addCategoryToBlog(uuid: string, addCategoryDto: AddCategoryDto, adminId: string): Promise<UpdateBlogResponseDto> {
//     const queryRunner = this.blogRepository.manager.connection.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       const admin = await this.userRepository.findOne({ where: { id: Number(adminId) } });
//       if (!admin) {
//         throw new NotFoundException('Admin user not found');
//       }

//       const blog = await this.blogRepository.findOne({
//         where: { uuid },
//         relations: ['categories', 'author', 'tags'],
//       });
//       if (!blog) {
//         throw new NotFoundException('Blog not found');
//       }

//       const category = await queryRunner.manager.findOne(ProductCategory, {
//         where: { uuid: addCategoryDto.categoryId },
//       });
//       if (!category) {
//         throw new NotFoundException('Category not found');
//       }

//       // Check if category is already assigned
//       if (blog.categories.some(cat => cat.uuid === addCategoryDto.categoryId)) {
//         throw new BadRequestException('Category already assigned to blog');
//       }

//       blog.categories.push(category);
//       const updatedBlog = await queryRunner.manager.save(Blog, blog);
//       await queryRunner.commitTransaction();

//       const updatedBlogDto: CreateSingleBlogDto = BlogAdminProvider.toCreateBlog(updatedBlog);

//       const response: UpdateBlogResponseDto = {
//         data: updatedBlogDto,
//         statusCode: HttpStatus.OK,
//       };

//       return response;
//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       if (error instanceof NotFoundException || error instanceof BadRequestException) {
//         throw error;
//       }
//       throw new InternalServerErrorException(`Failed to add category to blog: ${error.message}`);
//     } finally {
//       await queryRunner.release();
//     }
//   }

//   async removeCategoryFromBlog(uuid: string, removeCategoryDto: RemoveCategoryDto, adminId: string): Promise<UpdateBlogResponseDto> {
//     const queryRunner = this.blogRepository.manager.connection.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       const admin = await this.userRepository.findOne({ where: { id: Number(adminId) } });
//       if (!admin) {
//         throw new NotFoundException('Admin user not found');
//       }

//       const blog = await this.blogRepository.findOne({
//         where: { uuid },
//         relations: ['categories', 'author', 'tags'],
//       });
//       if (!blog) {
//         throw new NotFoundException('Blog not found');
//       }

//       const category = await queryRunner.manager.findOne(ProductCategory, {
//         where: { uuid: removeCategoryDto.categoryId },
//       });
//       if (!category) {
//         throw new NotFoundException('Category not found');
//       }

//       // Check if category is assigned
//       const categoryIndex = blog.categories.findIndex(cat => cat.uuid === removeCategoryDto.categoryId);
//       if (categoryIndex === -1) {
//         throw new BadRequestException('Category not assigned to blog');
//       }

//       blog.categories.splice(categoryIndex, 1);
//       const updatedBlog = await queryRunner.manager.save(Blog, blog);
//       await queryRunner.commitTransaction();

//       const updatedBlogDto: CreateSingleBlogDto = BlogAdminProvider.toCreateBlog(updatedBlog);

//       const response: UpdateBlogResponseDto = {
//         data: updatedBlogDto,
//         statusCode: HttpStatus.OK,
//       };

//       return response;
//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       if (error instanceof NotFoundException || error instanceof BadRequestException) {
//         throw error;
//       }
//       throw new InternalServerErrorException(`Failed to remove category from blog: ${error.message}`);
//     } finally {
//       await queryRunner.release();
//     }
//   }













}