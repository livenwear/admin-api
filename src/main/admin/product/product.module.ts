import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductAdminService } from './product.service';
import { ProductAdminController } from './product.controller';
import { AuthModule } from 'src/main/auth/auth.module';
import { User, Product } from 'src/entities';
import { SlugService } from 'src/common/slug.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, User]),AuthModule],
  controllers: [ProductAdminController],
  providers: [ProductAdminService,SlugService],
  exports: [],
})
export class ProductAdminModule {}
