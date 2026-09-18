export enum StorageNamespace {
  PRODUCTS = 'products',
  PRODUCT_CATEGORIES = 'product-categories',
  BRANDS = 'brands',
  BLOG = 'blog',
  BLOG_TAGS = 'blog-tags',
  BLOG_CATEGORIES = 'blog-categories',
  BANNERS = 'banners',
  SLIDERS = 'sliders',
  PROMO_CARDS = 'promo-cards',
  TICKETS = 'tickets',
  CHAT = 'chat',
  ORDERS = 'orders',
  USERS = 'users',
  GENERAL = 'general',
  /** Shipping method logos — publicly readable on storefront */
  SHIPPING = 'shipping',
}

export const STORAGE_NAMESPACE_VALUES = Object.values(StorageNamespace);

export enum StorageBucketType {
  IMAGE = 'image',
  FILE = 'file',
  TEMP = 'temp',
}

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export const FILE_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
] as const;

export const NAMESPACE_BUCKET_MAP: Record<StorageNamespace, StorageBucketType> = {
  [StorageNamespace.PRODUCTS]: StorageBucketType.IMAGE,
  [StorageNamespace.PRODUCT_CATEGORIES]: StorageBucketType.IMAGE,
  [StorageNamespace.BRANDS]: StorageBucketType.IMAGE,
  [StorageNamespace.BLOG]: StorageBucketType.IMAGE,
  [StorageNamespace.BLOG_TAGS]: StorageBucketType.IMAGE,
  [StorageNamespace.BLOG_CATEGORIES]: StorageBucketType.IMAGE,
  [StorageNamespace.BANNERS]: StorageBucketType.IMAGE,
  [StorageNamespace.SLIDERS]: StorageBucketType.IMAGE,
  [StorageNamespace.PROMO_CARDS]: StorageBucketType.IMAGE,
  [StorageNamespace.TICKETS]: StorageBucketType.FILE,
  [StorageNamespace.CHAT]: StorageBucketType.FILE,
  [StorageNamespace.ORDERS]: StorageBucketType.FILE,
  [StorageNamespace.USERS]: StorageBucketType.IMAGE,
  [StorageNamespace.GENERAL]: StorageBucketType.IMAGE,
  [StorageNamespace.SHIPPING]: StorageBucketType.IMAGE,
};

export const THUMBNAIL_PRESETS = {
  thumb: { width: 150, height: 150, fit: 'cover' as const },
  small: { width: 400, height: 400, fit: 'inside' as const },
  medium: { width: 800, height: 800, fit: 'inside' as const },
};

export type ThumbnailPreset = keyof typeof THUMBNAIL_PRESETS;

export const THUMBNAIL_PRESET_VALUES = Object.keys(
  THUMBNAIL_PRESETS,
) as ThumbnailPreset[];

export const MINIO_CLIENT = 'MINIO_CLIENT';
