import { StorageNamespace, ThumbnailPreset } from './storage.constants';

export interface ThumbnailInfo {
  preset: ThumbnailPreset;
  objectKey: string;
  publicUrl: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
}

export interface StoredFileMetadata {
  fileId: string;
  bucket: string;
  objectKey: string;
  namespace: StorageNamespace;
  entityId?: string;
  variant?: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
  publicUrl: string;
  isPublic: boolean;
  uploadedAt: string;
  thumbnails?: ThumbnailInfo[];
}

export interface ListFilesResult {
  items: StoredFileMetadata[];
  total: number;
  prefix: string;
  hasMore: boolean;
}

export interface NamespaceInfo {
  namespace: string;
  bucket: string;
  keyPattern: string;
  example: string;
}

export interface StorageHealthResult {
  status: string;
  service: string;
  minio: {
    endpoint: string;
    buckets: Record<string, boolean>;
  };
  console: string;
}

export interface UploadFileOptions {
  namespace: StorageNamespace;
  entityId?: string;
  variant?: string;
  generateThumbnails?: boolean;
}

export interface ListFilesOptions {
  namespace: StorageNamespace;
  entityId?: string;
  limit?: number;
}

export interface MediaReconcileResult {
  scannedDbRows: number;
  scannedMinioObjects: number;
  /** DB rows soft-deleted because MinIO object was missing */
  removedDbOrphans: number;
  /** MinIO objects deleted because no active DB row referenced them */
  removedMinioOrphans: number;
  /** Soft-deleted DB rows whose leftover MinIO objects were cleaned */
  cleanedSoftDeletedStorage: number;
  /** Orphan thumbnail prefixes removed */
  removedOrphanThumbnails: number;
  namespaces: string[];
}

export interface PersistUploadedFileOptions {
  entityId?: string | null;
  isPublic?: boolean;
  publicUrl?: string;
  metadata?: Record<string, unknown> | null;
  mimeTypeOverride?: string;
  extensionOverride?: string | null;
}
