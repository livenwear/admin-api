import { Role } from './auth/role.entity';
import { Permission } from './auth/permission.entity';
import { User } from './auth/user.entity';
import { UserRoleEntity } from './auth/user-role.entity';
import { RolePermission } from './auth/role-permission.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { AuditLog } from './auth/audit-log.entity';
import { ImpersonationGrant } from './auth/impersonation-grant.entity';

import { Category } from './catalog/category.entity';
import { Brand } from './catalog/brand.entity';
import { Collection } from './catalog/collection.entity';
import { Tag } from './catalog/tag.entity';

import { Product } from './products/product.entity';
import { ProductVariant } from './products/product-variant.entity';
import { Attribute } from './products/attribute.entity';
import { AttributeValue } from './products/attribute-value.entity';
import { VariantAttributeValue } from './products/variant-attribute-value.entity';
import { ProductCategory } from './products/product-category.entity';
import { ProductImage } from './products/product-image.entity';
import { ProductFile } from './products/product-file.entity';
import { ProductTag } from './products/product-tag.entity';
import { ProductCollection } from './products/product-collection.entity';
import { ProductRelated } from './products/product-related.entity';
import { ProductLabel } from './products/product-label.entity';
import { ProductSpecification } from './products/product-specification.entity';

import { Price } from './pricing/price.entity';
import { TierPrice } from './pricing/tier-price.entity';
import { Discount } from './pricing/discount.entity';
import { DiscountProduct } from './pricing/discount-product.entity';
import { DiscountCategory } from './pricing/discount-category.entity';
import { DiscountBrand } from './pricing/discount-brand.entity';
import { Coupon } from './pricing/coupon.entity';
import { CouponProduct } from './pricing/coupon-product.entity';
import { CouponCategory } from './pricing/coupon-category.entity';

import { Warehouse } from './inventory/warehouse.entity';
import { Inventory } from './inventory/inventory.entity';
import { StockMovement } from './inventory/stock-movement.entity';

import { Cart } from './shopping/cart.entity';
import { CartItem } from './shopping/cart-item.entity';
import { Wishlist } from './shopping/wishlist.entity';
import { WishlistItem } from './shopping/wishlist-item.entity';

import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { Payment } from './orders/payment.entity';
import { Shipment } from './orders/shipment.entity';
import { Invoice } from './orders/invoice.entity';

import { Post } from './content/post.entity';
import { PostCategory } from './content/post-category.entity';
import { PostTag } from './content/post-tag.entity';
import { PostCategoryRelation } from './content/post-category-relation.entity';
import { PostTagRelation } from './content/post-tag-relation.entity';
import { PostProduct } from './content/post-product.entity';
import { PostShopCategory } from './content/post-shop-category.entity';
import { Comment } from './content/comment.entity';

import { FileEntity } from './media/file.entity';

import { Banner } from './cms/banner.entity';
import { Slider } from './cms/slider.entity';
import { SliderItem } from './cms/slider-item.entity';
import { PromoCardRow } from './cms/promo-card-row.entity';
import { PromoCard } from './cms/promo-card.entity';
import { Menu } from './cms/menu.entity';
import { MenuItem } from './cms/menu-item.entity';
import { Page } from './cms/page.entity';
import { Setting } from './cms/setting.entity';

import { Address } from './customer/address.entity';
import { Review } from './customer/review.entity';
import { Notification } from './customer/notification.entity';
import { NewsletterSubscriber } from './customer/newsletter-subscriber.entity';
import { ContactMessage } from './customer/contact-message.entity';
import { SupportTicket } from './customer/support-ticket.entity';
import { SupportTicketMessage } from './customer/support-ticket-message.entity';
import { ChatConversation } from './chat/chat-conversation.entity';
import { ChatMessage } from './chat/chat-message.entity';

export const ALL_ENTITIES = [
  // Auth
  Role,
  Permission,
  User,
  UserRoleEntity,
  RolePermission,
  RefreshToken,
  AuditLog,
  ImpersonationGrant,
  // Catalog
  Category,
  Brand,
  Collection,
  Tag,
  // Products
  Product,
  ProductVariant,
  Attribute,
  AttributeValue,
  VariantAttributeValue,
  ProductCategory,
  ProductImage,
  ProductFile,
  ProductTag,
  ProductCollection,
  ProductRelated,
  ProductLabel,
  ProductSpecification,
  // Pricing
  Price,
  TierPrice,
  Discount,
  DiscountProduct,
  DiscountCategory,
  DiscountBrand,
  Coupon,
  CouponProduct,
  CouponCategory,
  // Inventory
  Warehouse,
  Inventory,
  StockMovement,
  // Shopping
  Cart,
  CartItem,
  Wishlist,
  WishlistItem,
  // Orders
  Order,
  OrderItem,
  Payment,
  Shipment,
  Invoice,
  // Content
  Post,
  PostCategory,
  PostTag,
  PostCategoryRelation,
  PostTagRelation,
  PostProduct,
  PostShopCategory,
  Comment,
  // Media
  FileEntity,
  // CMS
  Banner,
  Slider,
  SliderItem,
  PromoCardRow,
  PromoCard,
  Menu,
  MenuItem,
  Page,
  Setting,
  // Customer
  Address,
  Review,
  Notification,
  NewsletterSubscriber,
  ContactMessage,
  SupportTicket,
  SupportTicketMessage,
  ChatConversation,
  ChatMessage,
] as const;

export { AbstractEntity } from './common/abstract.entity';
export * from './enums';

export {
  Role,
  Permission,
  User,
  UserRoleEntity,
  RolePermission,
  RefreshToken,
  AuditLog,
  ImpersonationGrant,
  Category,
  Brand,
  Collection,
  Tag,
  Product,
  ProductVariant,
  Attribute,
  AttributeValue,
  VariantAttributeValue,
  ProductCategory,
  ProductImage,
  ProductFile,
  ProductTag,
  ProductCollection,
  ProductRelated,
  ProductLabel,
  ProductSpecification,
  Price,
  TierPrice,
  Discount,
  DiscountProduct,
  DiscountCategory,
  DiscountBrand,
  Coupon,
  CouponProduct,
  CouponCategory,
  Warehouse,
  Inventory,
  StockMovement,
  Cart,
  CartItem,
  Wishlist,
  WishlistItem,
  Order,
  OrderItem,
  Payment,
  Shipment,
  Invoice,
  Post,
  PostCategory,
  PostTag,
  PostCategoryRelation,
  PostTagRelation,
  PostProduct,
  PostShopCategory,
  Comment,
  FileEntity,
  Banner,
  Slider,
  SliderItem,
  PromoCardRow,
  PromoCard,
  Menu,
  MenuItem,
  Page,
  Setting,
  Address,
  Review,
  Notification,
  NewsletterSubscriber,
  ContactMessage,
  SupportTicket,
  SupportTicketMessage,
  ChatConversation,
  ChatMessage,
};
