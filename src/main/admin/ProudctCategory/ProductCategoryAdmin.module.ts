import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductCategoryAdminService } from './ProductCategoryAdminService.service';
import { ProductCategoryAdminController } from './ProductCategoryAdmin.controller';
import { AuthModule } from 'src/main/auth/auth.module';
import { User } from 'src/database/entities/user/user.entity';
import { ProductCategory } from 'src/database/entities/product/product-category.entity';
import { SlugService } from 'src/common/slug.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductCategory, User]),AuthModule],
  controllers: [ProductCategoryAdminController],
  providers: [ProductCategoryAdminService,SlugService],
  exports: [],
})
export class ProductCategoryAdminModule {}
