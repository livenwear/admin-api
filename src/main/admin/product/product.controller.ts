import { Body, Controller, Post, UseGuards, Request, Get, Query } from '@nestjs/common';
import { ProductAdminService } from './product.service';
import { Roles } from 'src/main/auth/strategies/roles.decorator';
import { UserRole } from 'src/common/type';
import { JwtAuthGuard } from 'src/main/auth/strategies/jwt.strategy';
import { CreateProductAdminDto, GetProductsAdminDto } from './dto';
@Controller('/admin/products')
export class ProductAdminController {
  constructor(private readonly productAdminService: ProductAdminService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async createProductByAdmin(
    @Body() dto: CreateProductAdminDto,
    @Request() req: any,
  ) {
    return this.productAdminService.createProductByAdmin(dto);
  }


@Get()
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
async getProducts(@Query() query: GetProductsAdminDto) {
  return this.productAdminService.getProducts(query);
}
}
