import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Attribute,
  Banner,
  Category,
  FileEntity,
  Post,
  PostCategory,
  PostTag,
  Product,
  ProductImage,
  ProductRelated,
  PromoCard,
  PromoCardRow,
  Review,
  Slider,
  SliderItem,
} from 'src/entities';
import { PublicMagController } from './public-mag.controller';
import { PublicMagService } from './public-mag.service';
import { PublicStorefrontController } from './public-storefront.controller';
import { PublicStorefrontService } from './public-storefront.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Banner,
      Slider,
      SliderItem,
      PromoCardRow,
      PromoCard,
      Category,
      Product,
      ProductImage,
      ProductRelated,
      FileEntity,
      Review,
      Attribute,
      Post,
      PostCategory,
      PostTag,
    ]),
  ],
  controllers: [PublicStorefrontController, PublicMagController],
  providers: [PublicStorefrontService, PublicMagService],
})
export class PublicModule {}
