export { ProductStatus } from './product-status.enum';
export { ProductType } from './product-type.enum';
export { AttributeType } from './attribute-type.enum';
export { DiscountType } from './discount-type.enum';
export { StockMovementType } from './stock-movement-type.enum';
export { OrderStatus } from './order-status.enum';
export { PaymentStatus } from './payment-status.enum';
export { PaymentMethod } from './payment-method.enum';
export { ShipmentStatus } from './shipment-status.enum';
export { PostStatus } from './post-status.enum';
export {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from './ticket.enum';
export {
  ChatConversationStatus,
  ChatSenderRole,
  ChatMessageStatus,
  CHAT_MAX_ATTACHMENTS,
} from './chat.enum';

/** Role slugs stored in `roles.slug` — used by @Roles() */
export enum RoleSlug {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

/** Alias for existing @Roles(UserRole.ADMIN) call sites */
export const UserRole = RoleSlug;
export type UserRole = RoleSlug;
