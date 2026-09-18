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
import { RoleSlug } from 'src/entities';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { AdminCatalogService } from './admin-catalog.service';
import {
  AdminAttributeDto,
  AdminAttributeValueDto,
  AdminBrandDto,
  AdminCategoryDto,
  AdminCollectionDto,
  AdminTagDto,
  AdminUpdateAttributeDto,
  AdminUpdateAttributeValueDto,
  AdminUpdateBrandDto,
  AdminUpdateCategoryDto,
  AdminUpdateCollectionDto,
  AdminUpdateTagDto,
  CatalogListQueryDto,
} from './dto/catalog.dto';

@ApiTags('admin-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalogService: AdminCatalogService) {}

  // Brands
  @Get('brands')
  @ApiOperation({ summary: 'List brands' })
  listBrands(@Query() query: CatalogListQueryDto) {
    return this.catalogService.listBrands(query);
  }

  @Post('brands')
  createBrand(@Body() dto: AdminBrandDto) {
    return this.catalogService.createBrand(dto);
  }

  @Patch('brands/:uuid')
  updateBrand(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateBrandDto,
  ) {
    return this.catalogService.updateBrand(uuid, dto);
  }

  @Delete('brands/:uuid')
  deleteBrand(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.catalogService.deleteBrand(uuid);
  }

  // Categories
  @Get('categories')
  listCategories(@Query() query: CatalogListQueryDto) {
    return this.catalogService.listCategories(query);
  }

  @Post('categories')
  createCategory(@Body() dto: AdminCategoryDto) {
    return this.catalogService.createCategory(dto);
  }

  @Patch('categories/:uuid')
  updateCategory(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(uuid, dto);
  }

  @Delete('categories/:uuid')
  deleteCategory(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.catalogService.deleteCategory(uuid);
  }

  // Attributes
  @Get('attributes')
  listAttributes() {
    return this.catalogService.listAttributes();
  }

  @Post('attributes')
  createAttribute(@Body() dto: AdminAttributeDto) {
    return this.catalogService.createAttribute(dto);
  }

  @Patch('attributes/:uuid')
  updateAttribute(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateAttributeDto,
  ) {
    return this.catalogService.updateAttribute(uuid, dto);
  }

  @Delete('attributes/:uuid')
  deleteAttribute(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.catalogService.deleteAttribute(uuid);
  }

  @Post('attributes/:uuid/values')
  addValue(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminAttributeValueDto,
  ) {
    return this.catalogService.addAttributeValue(uuid, dto);
  }

  @Patch('attribute-values/:uuid')
  updateValue(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateAttributeValueDto,
  ) {
    return this.catalogService.updateAttributeValue(uuid, dto);
  }

  @Delete('attribute-values/:uuid')
  deleteValue(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.catalogService.deleteAttributeValue(uuid);
  }

  // Tags
  @Get('tags')
  listTags(@Query() query: CatalogListQueryDto) {
    return this.catalogService.listTags(query);
  }

  @Post('tags')
  createTag(@Body() dto: AdminTagDto) {
    return this.catalogService.createTag(dto);
  }

  @Patch('tags/:uuid')
  updateTag(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateTagDto,
  ) {
    return this.catalogService.updateTag(uuid, dto);
  }

  @Delete('tags/:uuid')
  deleteTag(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.catalogService.deleteTag(uuid);
  }

  // Collections
  @Get('collections')
  listCollections(@Query() query: CatalogListQueryDto) {
    return this.catalogService.listCollections(query);
  }

  @Post('collections')
  createCollection(@Body() dto: AdminCollectionDto) {
    return this.catalogService.createCollection(dto);
  }

  @Patch('collections/:uuid')
  updateCollection(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateCollectionDto,
  ) {
    return this.catalogService.updateCollection(uuid, dto);
  }

  @Delete('collections/:uuid')
  deleteCollection(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.catalogService.deleteCollection(uuid);
  }
}
