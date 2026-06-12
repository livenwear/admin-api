import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductAdminService } from './product.service';
import { ProductAdminController } from './product.controller';
import { AuthModule } from 'src/main/auth/auth.module';
import { User } from 'src/database/entities/user/user.entity';
import { Product } from 'src/database/entities/product/product.entity';
import { SlugService } from 'src/common/slug.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, User]),AuthModule],
  controllers: [ProductAdminController],
  providers: [ProductAdminService,SlugService],
  exports: [],
})
export class ProductAdminModule {}
