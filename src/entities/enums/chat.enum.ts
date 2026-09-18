export enum ChatConversationStatus {
  /** گفتگوی فعال — مشتری و ادمین می‌توانند بنویسند */
  OPEN = 'open',
  /** منتظر پاسخ پشتیبانی */
  WAITING = 'waiting',
  /** بسته شده توسط ادمین — مشتری نمی‌تواند پیام بدهد */
  CLOSED = 'closed',
}

export enum ChatSenderRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export enum ChatMessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

/** Max image attachments per conversation */
export const CHAT_MAX_ATTACHMENTS = 5;
