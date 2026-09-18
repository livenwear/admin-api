import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Attribute,
  AttributeValue,
  AuditLog,
  Banner,
  Brand,
  Category,
  Collection,
  FileEntity,
  ImpersonationGrant,
  Inventory,
  Order,
  Payment,
  Price,
  Product,
  ProductCategory,
  ProductCollection,
  ProductFile,
  ProductImage,
  ProductLabel,
  ProductRelated,
  ProductSpecification,
  ProductTag,
  ProductVariant,
  PromoCard,
  PromoCardRow,
  Post,
  PostCategory,
  PostCategoryRelation,
  PostProduct,
  PostShopCategory,
  PostTag,
  PostTagRelation,
  RefreshToken,
  Review,
  Role,
  Slider,
  SliderItem,
  StockMovement,
  SupportTicket,
  SupportTicketMessage,
  Tag,
  User,
  UserRoleEntity,
  VariantAttributeValue,
  Warehouse,
  Wishlist,
  WishlistItem,
  Cart,
  CartItem,
  Address,
} from 'src/entities';
import { AdminAddressesController } from './addresses/admin-addresses.controller';
import { AdminAddressesService } from './addresses/admin-addresses.service';
import { AdminBlogController } from './blog/admin-blog.controller';
import { AdminBlogService } from './blog/admin-blog.service';
import { AdminCartsController } from './carts/admin-carts.controller';
import { AdminCartsService } from './carts/admin-carts.service';
import { AdminCatalogController } from './catalog/admin-catalog.controller';
import { AdminCatalogService } from './catalog/admin-catalog.service';
import { AdminCmsController } from './cms/admin-cms.controller';
import { AdminCmsService } from './cms/admin-cms.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminInventoryController } from './inventory/admin-inventory.controller';
import { AdminInventoryService } from './inventory/admin-inventory.service';
import { AdminMediaController } from './media/admin-media.controller';
import { AdminMediaService } from './media/admin-media.service';
import { AdminProductsController } from './products/admin-products.controller';
import { AdminProductsService } from './products/admin-products.service';
import { AdminReviewsController } from './reviews/admin-reviews.controller';
import { AdminReviewsService } from './reviews/admin-reviews.service';
import { AdminTicketsController } from './tickets/admin-tickets.controller';
import { AdminTicketsService } from './tickets/admin-tickets.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminWishlistController } from './wishlist/admin-wishlist.controller';
import { AdminWishlistService } from './wishlist/admin-wishlist.service';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [
    CustomerModule,
    TypeOrmModule.forFeature([
      User,
      Role,
      UserRoleEntity,
      ImpersonationGrant,
      AuditLog,
      Order,
      RefreshToken,
      FileEntity,
      Brand,
      Category,
      Attribute,
      AttributeValue,
      Tag,
      Collection,
      Product,
      ProductVariant,
      Price,
      ProductImage,
      ProductCategory,
      ProductSpecification,
      ProductTag,
      ProductCollection,
      ProductLabel,
      ProductRelated,
      ProductFile,
      VariantAttributeValue,
      Warehouse,
      Inventory,
      Banner,
      Slider,
      SliderItem,
      PromoCardRow,
      PromoCard,
      Review,
      SupportTicket,
      SupportTicketMessage,
      Wishlist,
      WishlistItem,
      Cart,
      CartItem,
      Address,
      StockMovement,
      Post,
      PostCategory,
      PostTag,
      PostCategoryRelation,
      PostTagRelation,
      PostProduct,
      PostShopCategory,
      Payment,
    ]),
  ],
  controllers: [
    AdminUsersController,
    AdminAddressesController,
    AdminInventoryController,
    AdminDashboardController,
    AdminMediaController,
    AdminCatalogController,
    AdminProductsController,
    AdminCmsController,
    AdminBlogController,
    AdminReviewsController,
    AdminTicketsController,
    AdminWishlistController,
    AdminCartsController,
  ],
  providers: [
    AdminUsersService,
    AdminAddressesService,
    AdminInventoryService,
    AdminDashboardService,
    AdminMediaService,
    AdminCatalogService,
    AdminProductsService,
    AdminCmsService,
    AdminBlogService,
    AdminReviewsService,
    AdminTicketsService,
    AdminWishlistService,
    AdminCartsService,
  ],
  exports: [
    AdminUsersService,
    AdminProductsService,
    AdminMediaService,
    AdminTicketsService,
  ],
})
export class AdminModule {}
