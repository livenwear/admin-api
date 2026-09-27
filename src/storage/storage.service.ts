import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import * as Minio from 'minio';
import sharp from 'sharp';
import {
  IMAGE_MIME_TYPES,
  NAMESPACE_BUCKET_MAP,
  STORAGE_NAMESPACE_VALUES,
  StorageBucketType,
  StorageNamespace,
  THUMBNAIL_PRESETS,
  ThumbnailPreset,
} from './storage.constants';
import {
  ListFilesOptions,
  ListFilesResult,
  NamespaceInfo,
  StorageHealthResult,
  StoredFileMetadata,
  ThumbnailInfo,
  UploadFileOptions,
} from './storage.types';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  /** Internal client — API ↔ MinIO on loopback (put/get/delete/stat). */
  private client: Minio.Client;
  /**
   * Presign-only client keyed to MINIO_PUBLIC_URL (e.g. https://cdn.livenmode.ir).
   * Signing is local crypto; Host must match what the browser sends through nginx.
   */
  private presignClient: Minio.Client;
  private buckets: Record<StorageBucketType, string>;
  private publicBaseUrl: string;
  private endpoint: string;
  private consoleUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = Number(this.configService.get<string>('MINIO_PORT', '9000'));
    const useSSL =
      this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.configService.get<string>(
      'MINIO_ACCESS_KEY',
      'minioadmin',
    );
    const secretKey = this.configService.get<string>(
      'MINIO_SECRET_KEY',
      'minioadmin',
    );

    this.endpoint = `${useSSL ? 'https' : 'http'}://${endPoint}:${port}`;
    this.consoleUrl = this.configService.get<string>(
      'MINIO_CONSOLE_URL',
      `http://${endPoint}:9001`,
    );
    this.publicBaseUrl = this.configService.get<string>(
      'MINIO_PUBLIC_URL',
      this.endpoint,
    );

    this.buckets = {
      [StorageBucketType.IMAGE]: this.configService.get<string>(
        'MINIO_BUCKET_IMAGES',
        'liven-images',
      ),
      [StorageBucketType.FILE]: this.configService.get<string>(
        'MINIO_BUCKET_FILES',
        'liven-files',
      ),
      [StorageBucketType.TEMP]: this.configService.get<string>(
        'MINIO_BUCKET_TEMP',
        'liven-temp',
      ),
    };

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    const publicEp = this.parseEndpointUrl(this.publicBaseUrl) ?? {
      endPoint,
      port,
      useSSL,
    };
    this.presignClient = new Minio.Client({
      endPoint: publicEp.endPoint,
      port: publicEp.port,
      useSSL: publicEp.useSSL,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit() {
    this.logger.log(
      `MinIO internal=${this.endpoint} public/presign=${this.publicBaseUrl}`,
    );
    try {
      for (const bucket of Object.values(this.buckets)) {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket, 'us-east-1');
          this.logger.log(`Created MinIO bucket: ${bucket}`);
        }

        // Private buckets — no anonymous public read (admin proxy / presign only)
        try {
          await this.client.setBucketPolicy(bucket, '');
        } catch {
          // empty policy may fail on some MinIO versions; try deny-all JSON
          try {
            await this.client.setBucketPolicy(
              bucket,
              JSON.stringify({
                Version: '2012-10-17',
                Statement: [],
              }),
            );
          } catch (error) {
            this.logger.warn(
              `Could not lock policy on ${bucket}: ${(error as Error).message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `MinIO is not reachable yet — storage endpoints will fail until MinIO is up: ${(error as Error).message}`,
      );
    }
  }

  async health(): Promise<StorageHealthResult> {
    const bucketStatus: Record<string, boolean> = {};
    for (const bucket of Object.values(this.buckets)) {
      try {
        bucketStatus[bucket] = await this.client.bucketExists(bucket);
      } catch {
        bucketStatus[bucket] = false;
      }
    }

    const allOk = Object.values(bucketStatus).every(Boolean);
    return {
      status: allOk ? 'ok' : 'degraded',
      service: 'liven-api-storage',
      minio: {
        endpoint: this.endpoint,
        buckets: bucketStatus,
      },
      console: this.consoleUrl,
    };
  }

  getNamespaces(): NamespaceInfo[] {
    return STORAGE_NAMESPACE_VALUES.map((namespace) => {
      const bucket = this.resolveBucket(namespace);
      return {
        namespace,
        bucket,
        keyPattern: `${namespace}/{entityId?}/{fileId}{ext}`,
        example: `${namespace}/entity-uuid/${randomUUID()}.webp`,
      };
    });
  }

  async upload(
    file: Buffer,
    filename: string,
    mimeType: string,
    options: UploadFileOptions,
  ): Promise<StoredFileMetadata> {
    const fileId = randomUUID();
    const extension = extname(filename) || this.extensionFromMime(mimeType);
    const objectKey = this.buildObjectKey(
      options.namespace,
      fileId,
      extension,
      options.entityId,
      options.variant,
    );
    const bucket = this.resolveBucket(options.namespace);

    await this.client.putObject(bucket, objectKey, file, file.length, {
      'Content-Type': mimeType,
      'x-amz-meta-original-name': filename,
      'x-amz-meta-namespace': options.namespace,
      ...(options.entityId ? { 'x-amz-meta-entity-id': options.entityId } : {}),
      ...(options.variant ? { 'x-amz-meta-variant': options.variant } : {}),
    });

    let thumbnails: ThumbnailInfo[] | undefined;
    const shouldThumb =
      options.generateThumbnails !== false &&
      IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number]) &&
      mimeType !== 'image/svg+xml';

    if (shouldThumb) {
      thumbnails = await this.generateThumbnails(
        file,
        bucket,
        options.namespace,
        fileId,
        options.entityId,
      );
    }

    return {
      fileId,
      bucket,
      objectKey,
      namespace: options.namespace,
      entityId: options.entityId,
      variant: options.variant,
      originalName: filename,
      mimeType,
      size: file.length,
      extension,
      publicUrl: '',
      isPublic: false,
      uploadedAt: new Date().toISOString(),
      thumbnails,
    };
  }

  async list(options: ListFilesOptions): Promise<ListFilesResult> {
    const bucket = this.resolveBucket(options.namespace);
    const prefix = options.entityId
      ? `${options.namespace}/${options.entityId}/`
      : `${options.namespace}/`;
    const limit = options.limit ?? 50;

    const items: StoredFileMetadata[] = [];
    const stream = this.client.listObjectsV2(bucket, prefix, true);

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj) => {
        if (!obj.name || obj.name.includes('/thumbs/')) return;
        if (items.length >= limit) return;

        const parts = obj.name.split('/');
        const fileName = parts[parts.length - 1];
        const fileId = fileName.replace(extname(fileName), '');

        items.push({
          fileId,
          bucket,
          objectKey: obj.name,
          namespace: options.namespace,
          entityId: options.entityId,
          originalName: fileName,
          mimeType: 'application/octet-stream',
          size: obj.size ?? 0,
          extension: extname(fileName),
          publicUrl: this.publicUrl(bucket, obj.name),
          isPublic: true,
          uploadedAt: (obj.lastModified ?? new Date()).toISOString(),
        });
      });
      stream.on('error', reject);
      stream.on('end', () => resolve());
    });

    return {
      items,
      total: items.length,
      prefix,
      hasMore: items.length >= limit,
    };
  }

  async getMetadata(bucket: string, objectKey: string): Promise<StoredFileMetadata> {
    const stat = await this.client.statObject(bucket, objectKey);
    const meta = stat.metaData ?? {};
    const namespace = (meta.namespace ||
      objectKey.split('/')[0]) as StorageNamespace;
    const fileName = objectKey.split('/').pop() ?? objectKey;
    const fileId = fileName.replace(extname(fileName), '');

    return {
      fileId,
      bucket,
      objectKey,
      namespace,
      entityId: meta['entity-id'],
      variant: meta.variant,
      originalName: meta['original-name'] || fileName,
      mimeType: stat.metaData?.['content-type'] || 'application/octet-stream',
      size: stat.size,
      extension: extname(fileName),
      publicUrl: this.publicUrl(bucket, objectKey),
      isPublic: true,
      uploadedAt: stat.lastModified.toISOString(),
    };
  }

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      await this.client.statObject(bucket, objectKey);
      return true;
    } catch (err) {
      if (this.isNotFoundError(err)) return false;
      throw err;
    }
  }

  async listObjectKeys(bucket: string, prefix = ''): Promise<string[]> {
    const keys: string[] = [];
    const stream = this.client.listObjectsV2(bucket, prefix, true);
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) keys.push(obj.name);
      });
      stream.on('error', reject);
      stream.on('end', () => resolve());
    });
    return keys;
  }

  async removeObjectKeys(bucket: string, keys: string[]): Promise<void> {
    if (!keys.length) return;
    // MinIO removeObjects accepts batches; keep chunks modest
    const chunkSize = 100;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      await this.client.removeObjects(bucket, chunk);
    }
  }

  isThumbnailKey(objectKey: string): boolean {
    return objectKey.includes('/thumbs/');
  }

  fileIdFromObjectKey(objectKey: string): string {
    const fileName = objectKey.split('/').pop() ?? objectKey;
    return fileName.replace(extname(fileName), '');
  }

  thumbnailFileIdFromKey(objectKey: string): string | null {
    const match = objectKey.match(/\/thumbs\/([^/]+)\//);
    return match?.[1] ?? null;
  }

  /** Public wrapper — used by reconcile to map namespace → bucket */
  resolveBucketPublic(namespace: StorageNamespace): string {
    return this.resolveBucket(namespace);
  }

  async delete(bucket: string, objectKey: string): Promise<{ message: string }> {
    try {
      await this.client.removeObject(bucket, objectKey);
    } catch (err) {
      if (!this.isNotFoundError(err)) throw err;
    }

    // Best-effort thumbnail cleanup
    const fileId = this.fileIdFromObjectKey(objectKey);
    const prefixParts = objectKey.split('/');
    prefixParts.pop();
    const thumbsPrefix = `${prefixParts.join('/')}/thumbs/${fileId}/`;

    try {
      const toRemove = await this.listObjectKeys(bucket, thumbsPrefix);
      if (toRemove.length) {
        await this.removeObjectKeys(bucket, toRemove);
      }
    } catch {
      // ignore thumbnail cleanup errors
    }

    return { message: 'File deleted' };
  }

  private isNotFoundError(err: unknown): boolean {
    const e = err as { code?: string; statusCode?: number; message?: string };
    return (
      e?.code === 'NotFound' ||
      e?.code === 'NoSuchKey' ||
      e?.statusCode === 404 ||
      /not\s*found/i.test(e?.message || '')
    );
  }

  getDownloadUrl(bucket: string, objectKey: string): string {
    return this.publicUrl(bucket, objectKey);
  }

  async getObjectStream(bucket: string, objectKey: string) {
    return this.client.getObject(bucket, objectKey);
  }

  /**
   * Short-lived signed URL for admin/browser display.
   * Always signed for MINIO_PUBLIC_URL host (cdn), never loopback —
   * otherwise browsers receive http://127.0.0.1:9010/... which only works on the VPS itself.
   */
  async getPresignedUrl(
    bucket: string,
    objectKey: string,
    expirySeconds = 3600,
  ): Promise<string> {
    return this.presignClient.presignedGetObject(
      bucket,
      objectKey,
      expirySeconds,
    );
  }

  private parseEndpointUrl(
    raw: string,
  ): { endPoint: string; port: number; useSSL: boolean } | null {
    try {
      const u = new URL(raw);
      if (!u.hostname) return null;
      const useSSL = u.protocol === 'https:';
      const port = u.port ? Number(u.port) : useSSL ? 443 : 80;
      return { endPoint: u.hostname, port, useSSL };
    } catch {
      return null;
    }
  }

  private resolveBucket(namespace: StorageNamespace): string {
    const type = NAMESPACE_BUCKET_MAP[namespace] ?? StorageBucketType.IMAGE;
    return this.buckets[type];
  }

  private buildObjectKey(
    namespace: StorageNamespace,
    fileId: string,
    extension: string,
    entityId?: string,
    variant?: string,
  ): string {
    const parts: string[] = [namespace];
    if (entityId) parts.push(entityId);
    if (variant) parts.push(variant);
    parts.push(`${fileId}${extension}`);
    return parts.join('/');
  }

  private publicUrl(bucket: string, objectKey: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${bucket}/${objectKey}`;
  }

  private extensionFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
    };
    return map[mimeType] || '';
  }

  private async generateThumbnails(
    file: Buffer,
    bucket: string,
    namespace: StorageNamespace,
    fileId: string,
    entityId?: string,
  ): Promise<ThumbnailInfo[]> {
    const results: ThumbnailInfo[] = [];

    for (const [preset, config] of Object.entries(THUMBNAIL_PRESETS) as [
      ThumbnailPreset,
      (typeof THUMBNAIL_PRESETS)[ThumbnailPreset],
    ][]) {
      try {
        const pipeline = sharp(file).resize(config.width, config.height, {
          fit: config.fit,
          withoutEnlargement: true,
        });
        const output = await pipeline.webp({ quality: 80 }).toBuffer();
        const meta = await sharp(output).metadata();
        const objectKey = [
          namespace,
          ...(entityId ? [entityId] : []),
          'thumbs',
          fileId,
          `${preset}.webp`,
        ].join('/');

        await this.client.putObject(bucket, objectKey, output, output.length, {
          'Content-Type': 'image/webp',
        });

        results.push({
          preset,
          objectKey,
          publicUrl: '',
          width: meta.width ?? config.width,
          height: meta.height ?? config.height,
          size: output.length,
          mimeType: 'image/webp',
        });
      } catch (error) {
        this.logger.warn(
          `Thumbnail ${preset} failed: ${(error as Error).message}`,
        );
      }
    }

    return results;
  }
}
