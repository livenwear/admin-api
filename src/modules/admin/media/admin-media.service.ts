import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from 'src/entities';
import {
  assertSafeSvgUpload,
  isSvgUpload,
  assertRasterImageUpload,
} from 'src/common/utils/svg-upload';
import { MediaFilesService } from 'src/storage/media-files.service';
import { StorageService } from 'src/storage/storage.service';
import { StorageNamespace } from 'src/storage/storage.constants';

@Injectable()
export class AdminMediaService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    private readonly storageService: StorageService,
    private readonly mediaFiles: MediaFilesService,
  ) {}

  async upload(
    file: Express.Multer.File,
    namespace: StorageNamespace,
    entityId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required.');
    }

    if (namespace === StorageNamespace.PRODUCT_CATEGORIES) {
      if (isSvgUpload(file)) {
        assertSafeSvgUpload(file);
      } else {
        assertRasterImageUpload(file);
      }
    } else if (
      namespace === StorageNamespace.BLOG ||
      namespace === StorageNamespace.BLOG_CATEGORIES ||
      namespace === StorageNamespace.BLOG_TAGS
    ) {
      assertRasterImageUpload(file);
    }

    const stored = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype ||
        (isSvgUpload(file) ? 'image/svg+xml' : 'application/octet-stream'),
      {
        namespace,
        entityId,
        generateThumbnails:
          namespace !== StorageNamespace.PRODUCT_CATEGORIES ||
          !isSvgUpload(file),
      },
    );

    const row = await this.mediaFiles.persistUploaded(stored, {
      entityId: entityId || null,
    });

    const url = await this.storageService.getPresignedUrl(
      row.bucket,
      row.objectKey,
      3600,
    );

    return {
      success: true,
      data: this.toDto(row, url),
    };
  }

  async list(query: {
    namespace?: string;
    page?: number;
    limit?: number;
    q?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(Number(query.limit) || 24, 1), 100);

    // Keep DB ↔ MinIO synchronized before serving the library
    if (page === 1) {
      await this.mediaFiles.reconcile(query.namespace?.trim() || undefined);
    }

    const sortBy =
      query.sortBy === 'size' || query.sortBy === 'originalName'
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.fileRepository.createQueryBuilder('f');

    if (query.namespace?.trim()) {
      qb.andWhere('f.namespace = :ns', { ns: query.namespace.trim() });
    }
    if (query.q?.trim()) {
      qb.andWhere('f.originalName ILIKE :q', {
        q: `%${query.q.trim()}%`,
      });
    }
    if (query.dateFrom?.trim()) {
      const from = new Date(query.dateFrom);
      if (!Number.isNaN(from.getTime())) {
        qb.andWhere('f.createdAt >= :dateFrom', { dateFrom: from });
      }
    }
    if (query.dateTo?.trim()) {
      const to = new Date(query.dateTo);
      if (!Number.isNaN(to.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.dateTo.trim())) {
          to.setHours(23, 59, 59, 999);
        }
        qb.andWhere('f.createdAt <= :dateTo', { dateTo: to });
      }
    }

    if (sortBy === 'size') {
      qb.orderBy('CAST(f.size AS BIGINT)', sortOrder);
    } else if (sortBy === 'originalName') {
      qb.orderBy('f.originalName', sortOrder);
    } else {
      qb.orderBy('f.createdAt', sortOrder);
    }

    const total = await qb.clone().getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    const data: ReturnType<AdminMediaService['toDto']>[] = [];
    for (const file of rows) {
      try {
        const accessUrl = await this.storageService.getPresignedUrl(
          file.bucket,
          file.objectKey,
          3600,
        );
        data.push(this.toDto(file, accessUrl));
      } catch {
        // Extremely rare race: object vanished after reconcile
        await this.fileRepository.softRemove(file);
      }
    }

    const from = total === 0 ? 0 : (safePage - 1) * limit + 1;
    const to = total === 0 ? 0 : Math.min(safePage * limit, total);

    return {
      success: true,
      data,
      meta: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
        from,
        to,
        sortBy,
        sortOrder,
      },
    };
  }

  async reconcile(namespace?: string) {
    const data = await this.mediaFiles.reconcile(namespace);
    return {
      success: true,
      message: 'Media storage synchronized',
      data,
    };
  }

  async getAccessUrl(uuid: string, expirySeconds = 3600) {
    const file = await this.mediaFiles.requireStoredOrPurge(uuid);
    const url = await this.storageService.getPresignedUrl(
      file.bucket,
      file.objectKey,
      expirySeconds,
    );
    return {
      success: true,
      data: {
        uuid: file.uuid,
        url,
        expiresIn: expirySeconds,
        mimeType: file.mimeType,
      },
    };
  }

  async stream(uuid: string) {
    const file = await this.mediaFiles.requireStoredOrPurge(uuid);
    const stream = await this.storageService.getObjectStream(
      file.bucket,
      file.objectKey,
    );
    return { file, stream };
  }

  async remove(uuid: string) {
    await this.mediaFiles.removeSyncedByUuid(uuid);
    return { success: true, message: 'File deleted' };
  }

  toDto(file: FileEntity, accessUrl?: string) {
    return {
      uuid: file.uuid,
      namespace: file.namespace,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: Number(file.size),
      extension: file.extension,
      isPublic: false,
      entityId: file.entityId,
      createdAt: file.createdAt,
      accessUrl: accessUrl || null,
      metadata: file.metadata,
    };
  }
}
