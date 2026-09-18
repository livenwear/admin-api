import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Address,
  Cart,
  CartItem,
  FileEntity,
  Inventory,
  Order,
  OrderItem,
  Payment,
  ProductVariant,
  Setting,
  Shipment,
  StockMovement,
  User,
  Warehouse,
} from 'src/entities';
import { StorageModule } from 'src/storage/storage.module';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { CheckoutService } from './checkout.service';
import { CommerceSettingsService } from './commerce-settings.service';
import { CustomerCheckoutController } from './customer-checkout.controller';
import { OrderInventoryService } from './order-inventory.service';

@Module({
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([
      User,
      Setting,
      Order,
      OrderItem,
      Payment,
      Shipment,
      Cart,
      CartItem,
      Address,
      FileEntity,
      Warehouse,
      Inventory,
      StockMovement,
      ProductVariant,
    ]),
  ],
  controllers: [CustomerCheckoutController, AdminOrdersController],
  providers: [
    CommerceSettingsService,
    OrderInventoryService,
    CheckoutService,
    AdminOrdersService,
  ],
  exports: [CommerceSettingsService, CheckoutService, OrderInventoryService],
})
export class OrdersModule {}
