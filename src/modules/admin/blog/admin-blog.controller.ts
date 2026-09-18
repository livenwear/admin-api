import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleSlug, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { AdminBlogService } from './admin-blog.service';
import {
  AdminBlogListQueryDto,
  AdminBlogPostDto,
  AdminBlogTaxonomyDto,
  AdminUpdateBlogPostDto,
  AdminUpdateBlogTaxonomyDto,
} from './dto/blog.dto';

@ApiTags('admin-blog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/blog')
export class AdminBlogController {
  constructor(private readonly blogService: AdminBlogService) {}

  @Get('posts')
  @ApiOperation({ summary: 'List blog posts' })
  listPosts(@Query() query: AdminBlogListQueryDto) {
    return this.blogService.listPosts(query);
  }

  @Get('posts/:uuid')
  getPost(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.blogService.getPost(uuid);
  }

  @Post('posts')
  createPost(@Body() dto: AdminBlogPostDto, @CurrentUser() user: User) {
    return this.blogService.createPost(dto, user);
  }

  @Patch('posts/:uuid')
  updatePost(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateBlogPostDto,
  ) {
    return this.blogService.updatePost(uuid, dto);
  }

  @Delete('posts/:uuid')
  deletePost(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.blogService.deletePost(uuid);
  }

  @Get('categories')
  listCategories() {
    return this.blogService.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: AdminBlogTaxonomyDto) {
    return this.blogService.createCategory(dto);
  }

  @Patch('categories/:uuid')
  updateCategory(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateBlogTaxonomyDto,
  ) {
    return this.blogService.updateCategory(uuid, dto);
  }

  @Delete('categories/:uuid')
  deleteCategory(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.blogService.deleteCategory(uuid);
  }

  @Get('tags')
  listTags() {
    return this.blogService.listTags();
  }

  @Post('tags')
  createTag(@Body() dto: AdminBlogTaxonomyDto) {
    return this.blogService.createTag(dto);
  }

  @Patch('tags/:uuid')
  updateTag(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateBlogTaxonomyDto,
  ) {
    return this.blogService.updateTag(uuid, dto);
  }

  @Delete('tags/:uuid')
  deleteTag(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.blogService.deleteTag(uuid);
  }
}
