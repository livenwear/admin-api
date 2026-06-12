import { Body, Controller, Post, UseGuards, Get, Query, Param, Put, Delete, Request } from '@nestjs/common';
import { Roles } from 'src/main/auth/strategies/roles.decorator';
import { UserRole } from 'src/common/type';
import { JwtAuthGuard } from 'src/main/auth/strategies/jwt.strategy';
import { CreateProductCategoryDto, UpdateProductCategoryDto, ProductCategoryQueryDto, BaseResponseDto } from './dto';
import { ProductCategory } from 'src/database/entities/product/product-category.entity';
import { ProductCategoryAdminService } from './ProductCategoryAdminService.service';

@Controller('/product-categories')
export class ProductCategoryAdminController {
  constructor(private readonly categoryAdminService: ProductCategoryAdminService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async createCategory(@Body() dto: CreateProductCategoryDto, @Request() req: any) {
    return this.categoryAdminService.createCategory(dto, req);
  }

  // @Get(':uuid')
  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN)
  // async getCategoryByUuid(@Param('uuid') uuid: string): Promise<BaseResponseDto<ProductCategory>> {
  //   return this.categoryAdminService.getCategoryByUuid(uuid);
  // }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async getAllCategories(@Query() query: ProductCategoryQueryDto,
  ) {
    return this.categoryAdminService.getAllCategories(query);
  }

 @Put(':uuid')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
async updateCategory(@Param('uuid') uuid: string, @Body() dto: UpdateProductCategoryDto, @Request() req: any): Promise<BaseResponseDto<ProductCategory>> {
    return this.categoryAdminService.updateCategory({ ...dto, uuid }, req);
}


  // @Delete(':uuid')
  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN)
  // async deleteCategory(@Param('uuid') uuid: string): Promise<BaseResponseDto<null>> {
  //   return this.categoryAdminService.deleteCategory(uuid);
  // }
}