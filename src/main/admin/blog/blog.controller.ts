import { Body, Controller, Post, UseGuards, Request, Get, Query, Put, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { BlogAdminService } from './blog.service';
import { Roles } from 'src/main/auth/strategies/roles.decorator';
import { UserRole } from 'src/common/type';
import { JwtAuthGuard } from 'src/main/auth/strategies/jwt.strategy';
import { CreateBlogResponseDto, CreateBlogDto, GetBlogsQueryDto, GetBlogsResponseDto, UpdateBlogDto, AddCategoryDto, RemoveCategoryDto, UpdateBlogResponseDto } from './dto';

@ApiTags('Admin Blog Management')
@Controller('admin/blog')
export class BlogAdminController {
  constructor(private readonly blogAdminService: BlogAdminService) {}

  // @Post()
  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth('JWT')
  // @ApiOperation({
  //   summary: 'Create a new blog',
  //   description: 'Creates a new blog post with the provided details. Only accessible to admin users. If status is PUBLISHED, publishedAt is set to the current date if not provided.',
  // })
  // @ApiBody({ type: CreateBlogDto, description: 'Blog creation data including title, slug, content, and optional fields like categories and tags.' })
  // @ApiResponse({
  //   status: 201,
  //   description: 'Blog created successfully.',
  //   type: CreateBlogResponseDto,
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: 'Bad Request: Invalid input or slug already in use.',
  // })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Unauthorized: Missing or invalid JWT token.',
  // })
  // @ApiResponse({
  //   status: 403,
  //   description: 'Forbidden: User does not have admin role.',
  // })
  // @ApiResponse({
  //   status: 404,
  //   description: 'Not Found: Admin user or categories/tags not found.',
  // })
  // @ApiResponse({
  //   status: 500,
  //   description: 'Internal Server Error: Failed to create blog.',
  // })
  // async createBlogByAdmin(
  //   @Body() createBlogDto: CreateBlogDto,
  //   @Request() req: any,
  // ): Promise<CreateBlogResponseDto> {
  //   return this.blogAdminService.createBlogByAdmin(createBlogDto, req.user.id);
  // }

  // @Get()
  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth('JWT')
  // @ApiOperation({
  //   summary: 'Get all blogs with filters',
  //   description: 'Retrieves a paginated list of blogs with optional filters for title, slug, status, author, categories, tags, and other fields. Only accessible to admin users.',
  // })
  // @ApiQuery({
  //   name: 'page',
  //   required: false,
  //   type: Number,
  //   description: 'Page number for pagination (default: 1).',
  //   example: 1,
  // })
  // @ApiQuery({
  //   name: 'limit',
  //   required: false,
  //   type: Number,
  //   description: 'Number of blogs per page (default: 20, max: 100).',
  //   example: 20,
  // })
  // @ApiQuery({
  //   name: 'sortBy',
  //   required: false,
  //   type: String,
  //   description: 'Field to sort by (e.g., id, title, createdAt). Default: createdAt.',
  //   example: 'createdAt',
  // })
  // @ApiQuery({
  //   name: 'sortOrder',
  //   required: false,
  //   enum: ['ASC', 'DESC'],
  //   description: 'Sort order (ASC or DESC). Default: DESC.',
  //   example: 'DESC',
  // })
  // @ApiQuery({
  //   name: 'title',
  //   required: false,
  //   type: String,
  //   description: 'Filter by blog title (partial match, case-insensitive).',
  //   example: 'Tech Blog',
  // })
  // @ApiQuery({
  //   name: 'slug',
  //   required: false,
  //   type: String,
  //   description: 'Filter by blog slug (partial match, case-insensitive).',
  //   example: 'tech-blog',
  // })
  // @ApiQuery({
  //   name: 'status',
  //   required: false,
  //   type: String,
  //   description: 'Filter by blog status (comma-separated, e.g., "draft,published").',
  //   example: 'published',
  // })
  // @ApiQuery({
  //   name: 'authorId',
  //   required: false,
  //   type: String,
  //   description: 'Filter by author ID.',
  //   example: '123',
  // })
  // @ApiQuery({
  //   name: 'publishedAtFrom',
  //   required: false,
  //   type: String,
  //   description: 'Filter blogs published on or after this date (ISO format).',
  //   example: '2025-10-01T00:00:00Z',
  // })
  // @ApiQuery({
  //   name: 'publishedAtTo',
  //   required: false,
  //   type: String,
  //   description: 'Filter blogs published on or before this date (ISO format).',
  //   example: '2025-10-03T23:59:59Z',
  // })
  // @ApiQuery({
  //   name: 'priority',
  //   required: false,
  //   type: Number,
  //   description: 'Filter by blog priority.',
  //   example: 10,
  // })
  // @ApiQuery({
  //   name: 'metaTitle',
  //   required: false,
  //   type: String,
  //   description: 'Filter by meta title (partial match, case-insensitive).',
  //   example: 'Tech Insights',
  // })
  // @ApiQuery({
  //   name: 'metaDescription',
  //   required: false,
  //   type: String,
  //   description: 'Filter by meta description (partial match, case-insensitive).',
  //   example: 'Learn about tech',
  // })
  // @ApiQuery({
  //   name: 'metaKeywords',
  //   required: false,
  //   type: String,
  //   description: 'Filter by meta keywords (partial match, case-insensitive).',
  //   example: 'tech, programming',
  // })
  // @ApiQuery({
  //   name: 'excerpt',
  //   required: false,
  //   type: String,
  //   description: 'Filter by excerpt (partial match, case-insensitive).',
  //   example: 'summary',
  // })
  // @ApiQuery({
  //   name: 'featuredImage',
  //   required: false,
  //   type: String,
  //   description: 'Filter by featured image URL.',
  //   example: 'https://example.com/image.jpg',
  // })
  // @ApiQuery({
  //   name: 'canonicalUrl',
  //   required: false,
  //   type: String,
  //   description: 'Filter by canonical URL.',
  //   example: 'https://example.com/blog/tech',
  // })
  // @ApiQuery({
  //   name: 'categoryIds',
  //   required: false,
  //   type: String,
  //   description: 'Filter by category UUIDs (comma-separated).',
  //   example: '1960472c-3315-43b1-a29f-3549aa95244d',
  // })
  // @ApiQuery({
  //   name: 'tagIds',
  //   required: false,
  //   type: String,
  //   description: 'Filter by tag UUIDs (comma-separated).',
  //   example: '323e4567-e89b-12d3-a456-426614174002',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Blogs retrieved successfully.',
  //   type: GetBlogsResponseDto,
  // })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Unauthorized: Missing or invalid JWT token.',
  // })
  // @ApiResponse({
  //   status: 403,
  //   description: 'Forbidden: User does not have admin role.',
  // })
  // @ApiResponse({
  //   status: 500,
  //   description: 'Internal Server Error: Failed to fetch blogs.',
  // })
  // async getAllBlogs(@Query() query: GetBlogsQueryDto): Promise<GetBlogsResponseDto> {
  //   return this.blogAdminService.getAllBlogs(query);
  // }

  // @Put(':uuid')
  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth('JWT')
  // @ApiOperation({
  //   summary: 'Update a blog',
  //   description: 'Updates the specified blog’s details (excluding categories and tags) identified by its UUID. Only accessible to admin users. If status is changed to PUBLISHED and publishedAt is not set, it will be updated to the current date.',
  // })
  // @ApiParam({
  //   name: 'uuid',
  //   type: String,
  //   description: 'UUID of the blog to update.',
  //   example: '550e8400-e29b-41d4-a716-446655440000',
  // })
  // @ApiBody({ type: UpdateBlogDto, description: 'Blog update data including title, slug, content, and other fields (excluding categories and tags).' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Blog updated successfully.',
  //   type: UpdateBlogResponseDto,
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: 'Bad Request: Invalid input or slug already in use.',
  // })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Unauthorized: Missing or invalid JWT token.',
  // })
  // @ApiResponse({
  //   status: 403,
  //   description: 'Forbidden: User does not have admin role.',
  // })
  // @ApiResponse({
  //   status: 404,
  //   description: 'Not Found: Blog or admin user not found.',
  // })
  // @ApiResponse({
  //   status: 500,
  //   description: 'Internal Server Error: Failed to update blog.',
  // })
  // async updateBlogByAdmin(
  //   @Param('uuid') uuid: string,
  //   @Body() updateBlogDto: UpdateBlogDto,
  //   @Request() req: any,
  // ): Promise<UpdateBlogResponseDto> {
  //   return this.blogAdminService.updateBlogByAdmin(uuid, updateBlogDto, req.user.id);
  // }

  // @Put(':uuid/categories/add')
  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth('JWT')
  // @ApiOperation({
  //   summary: 'Add a category to a blog',
  //   description: 'Adds a category (by UUID) to the specified blog (by UUID). Only accessible to admin users.',
  // })
  // @ApiParam({
  //   name: 'uuid',
  //   type: String,
  //   description: 'UUID of the blog to add the category to.',
  //   example: '550e8400-e29b-41d4-a716-446655440000',
  // })
  // @ApiBody({ type: AddCategoryDto, description: 'Category UUID to add to the blog.' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Category added successfully.',
  //   type: UpdateBlogResponseDto,
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: 'Bad Request: Category already assigned to blog.',
  // })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Unauthorized: Missing or invalid JWT token.',
  // })
  // @ApiResponse({
  //   status: 403,
  //   description: 'Forbidden: User does not have admin role.',
  // })
  // @ApiResponse({
  //   status: 404,
  //   description: 'Not Found: Blog, category, or admin user not found.',
  // })
  // @ApiResponse({
  //   status: 500,
  //   description: 'Internal Server Error: Failed to add category to blog.',
  // })
  // async addCategoryToBlog(
  //   @Param('uuid') uuid: string,
  //   @Body() addCategoryDto: AddCategoryDto,
  //   @Request() req: any,
  // ): Promise<UpdateBlogResponseDto> {
  //   return this.blogAdminService.addCategoryToBlog(uuid, addCategoryDto, req.user.id);
  // }

  // @Put(':uuid/categories/remove')
  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth('JWT')
  // @ApiOperation({
  //   summary: 'Remove a category from a blog',
  //   description: 'Removes a category (by UUID) from the specified blog (by UUID). Only accessible to admin users.',
  // })
  // @ApiParam({
  //   name: 'uuid',
  //   type: String,
  //   description: 'UUID of the blog to remove the category from.',
  //   example: '550e8400-e29b-41d4-a716-446655440000',
  // })
  // @ApiBody({ type: RemoveCategoryDto, description: 'Category UUID to remove from the blog.' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Category removed successfully.',
  //   type: UpdateBlogResponseDto,
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: 'Bad Request: Category not assigned to blog.',
  // })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Unauthorized: Missing or invalid JWT token.',
  // })
  // @ApiResponse({
  //   status: 403,
  //   description: 'Forbidden: User does not have admin role.',
  // })
  // @ApiResponse({
  //   status: 404,
  //   description: 'Not Found: Blog, category, or admin user not found.',
  // })
  // @ApiResponse({
  //   status: 500,
  //   description: 'Internal Server Error: Failed to remove category from blog.',
  // })
  // async removeCategoryFromBlog(
  //   @Param('uuid') uuid: string,
  //   @Body() removeCategoryDto: RemoveCategoryDto,
  //   @Request() req: any,
  // ): Promise<UpdateBlogResponseDto> {
  //   return this.blogAdminService.removeCategoryFromBlog(uuid, removeCategoryDto, req.user.id);
  // }
}