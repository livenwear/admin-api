import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from 'src/database/entities/product/product-category.entity';
import { LandPublicService } from './landPublic.service';
import { LandPublicController } from './landPublic.controller';
@Module({
  imports: [TypeOrmModule.forFeature([ProductCategory]),],
  controllers: [LandPublicController],
  providers: [LandPublicService],
  exports: [],
})
export class LandPublicModule {}
