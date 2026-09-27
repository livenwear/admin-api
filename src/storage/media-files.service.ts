import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from 'src/entities';
import { STORAGE_NAMESPACE_VALUES, StorageNamespace } from './storage.constants';
import { StorageService } from './storage.service';
import {
  MediaReconcileResult,
  PersistUploadedFileOptions,
  StoredFileMetadata,
} from './storage.types';

/**
 * Single source of truth for keeping Postgres `files` rows and MinIO objects in sync.
 * Every upload/delete path should go through this service.
 */
@Injectable()
export class MediaFilesService {
  private readonly logger = new Logger(MediaFilesService.name);

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly storage: StorageService,
  ) {}

  /**
   * Persist MinIO upload metadata into DB. If DB insert fails, roll back the object.
   */
  async persistUploaded(
    stored: StoredFileMetadata,
    options: PersistUploadedFileOptions = {},
  ): Promise<FileEntity> {
    try {
      return await this.fileRepo.save(
        this.fileRepo.create({
          bucket: stored.bucket,
          objectKey: stored.objectKey,
          namespace: stored.namespace,
          originalName: stored.originalName,
          mimeType: options.mimeTypeOverride || stored.mimeType,
          size: String(stored.size),
          extension:
            options.extensionOverride !== undefined
              ? options.extensionOverride
              : stored.extension || null,
          publicUrl: options.publicUrl ?? '',
          entityId: options.entityId ?? stored.entityId ?? null,
          variant: stored.variant || null,
          metadata: {
            storageFileId: stored.fileId,
            thumbnails: stored.thumbnails ?? [],
            ...(options.metadata || {}),
          },
          isPublic: options.isPublic ?? false,
        }),
      );
    } catch (err) {
      try {
        await this.storage.delete(stored.bucket, stored.objectKey);
      } catch (cleanupErr) {
        this.logger.error(
          `Failed to roll back MinIO object ${stored.bucket}/${stored.objectKey} after DB error: ${(cleanupErr as Error).message}`,
        );
      }
      throw err;
    }
  }

  /**
   * Delete MinIO object (+ thumbs) then soft-delete DB row.
   * If MinIO object is already gone, still soft-deletes the row.
   * If MinIO delete fails while object still exists, DB row is kept.
   */
  async removeSynced(file: FileEntity): Promise<void> {
    try {
      await this.storage.delete(file.bucket, file.objectKey);
    } catch (err) {
      const stillThere = await this.storage.objectExists(
        file.bucket,
        file.objectKey,
      );
      if (stillThere) {
        throw err;
      }
    }
    await this.fileRepo.softRemove(file);
  }

  async removeSyncedByUuid(uuid: string): Promise<FileEntity> {
    const file = await this.fileRepo.findOne({ where: { uuid } });
    if (!file) throw new NotFoundException('File not found.');
    await this.removeSynced(file);
    return file;
  }

  /**
   * If the DB row's object is missing in MinIO, soft-delete the row and throw NotFound.
   */
  async requireStoredOrPurge(uuid: string): Promise<FileEntity> {
    const file = await this.fileRepo.findOne({ where: { uuid } });
    if (!file) throw new NotFoundException('File not found.');
    const exists = await this.storage.objectExists(file.bucket, file.objectKey);
    if (!exists) {
      await this.fileRepo.softRemove(file);
      throw new NotFoundException('File missing in storage.');
    }
    return file;
  }

  /**
   * Bidirectional reconcile between DB and MinIO.
   */
  async reconcile(namespace?: string): Promise<MediaReconcileResult> {
    const namespaces = namespace?.trim()
      ? [namespace.trim()]
      : [...STORAGE_NAMESPACE_VALUES];

    const result: MediaReconcileResult = {
      scannedDbRows: 0,
      scannedMinioObjects: 0,
      removedDbOrphans: 0,
      removedMinioOrphans: 0,
      cleanedSoftDeletedStorage: 0,
      removedOrphanThumbnails: 0,
      namespaces,
    };

    for (const ns of namespaces) {
      await this.reconcileNamespace(ns as StorageNamespace, result);
    }

    this.logger.log(
      `Media reconcile done — dbOrphans=${result.removedDbOrphans} minioOrphans=${result.removedMinioOrphans} softDeletedCleanup=${result.cleanedSoftDeletedStorage} orphanThumbs=${result.removedOrphanThumbnails}`,
    );

    return result;
  }

  private async reconcileNamespace(
    ns: StorageNamespace,
    result: MediaReconcileResult,
  ) {
    const bucket = this.storage.resolveBucketPublic(ns);

    const activeRows = await this.fileRepo.find({
      where: { namespace: ns },
    });
    result.scannedDbRows += activeRows.length;

    const activeKeys = new Set<string>();
    const activeFileIds = new Set<string>();

    for (const row of activeRows) {
      const exists = await this.storage.objectExists(row.bucket, row.objectKey);
      if (!exists) {
        await this.fileRepo.softRemove(row);
        result.removedDbOrphans += 1;
        continue;
      }
      activeKeys.add(row.objectKey);
      const fileId =
        (row.metadata?.storageFileId as string | undefined) ||
        this.storage.fileIdFromObjectKey(row.objectKey);
      if (fileId) activeFileIds.add(fileId);
    }

    // Soft-deleted rows must not leave objects behind
    const allRows = await this.fileRepo.find({
      where: { namespace: ns },
      withDeleted: true,
    });
    for (const row of allRows) {
      if (!row.deletedAt) continue;
      const exists = await this.storage.objectExists(row.bucket, row.objectKey);
      if (!exists) continue;
      try {
        await this.storage.delete(row.bucket, row.objectKey);
        result.cleanedSoftDeletedStorage += 1;
      } catch (err) {
        this.logger.warn(
          `Could not clean soft-deleted storage ${row.bucket}/${row.objectKey}: ${(err as Error).message}`,
        );
      }
    }

    const keys = await this.storage.listObjectKeys(bucket, `${ns}/`);
    result.scannedMinioObjects += keys.length;

    const mainKeys = keys.filter((k) => !this.storage.isThumbnailKey(k));
    const thumbKeys = keys.filter((k) => this.storage.isThumbnailKey(k));

    for (const key of mainKeys) {
      if (activeKeys.has(key)) continue;
      try {
        await this.storage.delete(bucket, key);
        result.removedMinioOrphans += 1;
      } catch (err) {
        this.logger.warn(
          `Could not remove orphan MinIO object ${bucket}/${key}: ${(err as Error).message}`,
        );
      }
    }

    const orphanThumbFileIds = new Set<string>();
    for (const key of thumbKeys) {
      const fileId = this.storage.thumbnailFileIdFromKey(key);
      if (!fileId || activeFileIds.has(fileId)) continue;
      orphanThumbFileIds.add(fileId);
    }

    for (const fileId of orphanThumbFileIds) {
      const prefixKeys = thumbKeys.filter((k) =>
        k.includes(`/thumbs/${fileId}/`),
      );
      if (!prefixKeys.length) continue;
      try {
        await this.storage.removeObjectKeys(bucket, prefixKeys);
        result.removedOrphanThumbnails += prefixKeys.length;
      } catch (err) {
        this.logger.warn(
          `Could not remove orphan thumbs for ${fileId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
