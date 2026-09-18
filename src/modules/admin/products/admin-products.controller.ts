import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
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
import { AdminProductsService } from './admin-products.service';
import {
  AdminCreateProductDto,
  AdminListProductsQueryDto,
  AdminUpdateProductDto,
  ProductImageDto,
  ProductImagesReorderDto,
} from './dto/admin-products.dto';

@ApiTags('admin-products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: AdminProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products with filters & pagination' })
  list(@Query() query: AdminListProductsQueryDto) {
    return this.productsService.list(query);
  }

  @Get(':uuid')
  getOne(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.productsService.getOne(uuid);
  }

  @Post()
  create(@Body() dto: AdminCreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':uuid')
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateProductDto,
  ) {
    return this.productsService.update(uuid, dto);
  }

  @Delete(':uuid')
  remove(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.productsService.remove(uuid);
  }

  @Post(':uuid/images')
  addImage(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: ProductImageDto,
  ) {
    return this.productsService.addImage(uuid, dto);
  }

  @Put(':uuid/images')
  @ApiOperation({ summary: 'Reorder product images and set primary' })
  reorderImages(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: ProductImagesReorderDto,
  ) {
    return this.productsService.reorderImages(uuid, dto.images);
  }

  @Delete(':uuid/images/:imageUuid')
  removeImage(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Param('imageUuid', ParseUUIDPipe) imageUuid: string,
  ) {
    return this.productsService.removeImage(uuid, imageUuid);
  }
}
