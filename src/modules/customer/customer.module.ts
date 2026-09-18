import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Address,
  Cart,
  CartItem,
  FileEntity,
  Notification,
  Order,
  Product,
  ProductRelated,
  ProductVariant,
  Review,
  SupportTicket,
  SupportTicketMessage,
  User,
  Wishlist,
  WishlistItem,
} from 'src/entities';
import { CustomerAddressesController } from './customer-addresses.controller';
import { CustomerAddressesService } from './customer-addresses.service';
import { CustomerCartController } from './customer-cart.controller';
import { CustomerCartService } from './customer-cart.service';
import { CustomerMyReviewsController } from './customer-my-reviews.controller';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { CustomerNotificationsService } from './customer-notifications.service';
import { CustomerProfileController } from './customer-profile.controller';
import { CustomerProfileService } from './customer-profile.service';
import { CustomerReviewsController } from './customer-reviews.controller';
import { CustomerReviewsService } from './customer-reviews.service';
import { CustomerTicketsController } from './customer-tickets.controller';
import { CustomerTicketsService } from './customer-tickets.service';
import { CustomerWishlistController } from './customer-wishlist.controller';
import { CustomerWishlistService } from './customer-wishlist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Review,
      Product,
      ProductVariant,
      ProductRelated,
      FileEntity,
      SupportTicket,
      SupportTicketMessage,
      Wishlist,
      WishlistItem,
      Cart,
      CartItem,
      Address,
      Notification,
      Order,
    ]),
  ],
  controllers: [
    CustomerReviewsController,
    CustomerMyReviewsController,
    CustomerTicketsController,
    CustomerWishlistController,
    CustomerCartController,
    CustomerAddressesController,
    CustomerProfileController,
    CustomerNotificationsController,
  ],
  providers: [
    CustomerReviewsService,
    CustomerTicketsService,
    CustomerWishlistService,
    CustomerCartService,
    CustomerAddressesService,
    CustomerProfileService,
    CustomerNotificationsService,
  ],
  exports: [
    CustomerWishlistService,
    CustomerCartService,
    CustomerAddressesService,
  ],
})
export class CustomerModule {}
