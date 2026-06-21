import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductCategoryAdminService } from './ProductCategoryAdminService.service';
import { ProductCategoryAdminController } from './ProductCategoryAdmin.controller';
import { AuthModule } from 'src/main/auth/auth.module';
import { User, ProductCategory } from '@liven/entities';
import { SlugService } from 'src/common/slug.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductCategory, User]),AuthModule],
  controllers: [ProductCategoryAdminController],
  providers: [ProductCategoryAdminService,SlugService],
  exports: [],
})
export class ProductCategoryAdminModule {}
