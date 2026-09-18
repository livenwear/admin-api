import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from 'src/entities';
import { assertSafeSvgUpload, isSvgUpload, assertRasterImageUpload } from 'src/common/utils/svg-upload';
import { StorageService } from 'src/storage/storage.service';
import { StorageNamespace } from 'src/storage/storage.constants';

@Injectable()
export class AdminMediaService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    private readonly storageService: StorageService,
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

    let row: FileEntity;
    try {
      row = await this.fileRepository.save(
        this.fileRepository.create({
          bucket: stored.bucket,
          objectKey: stored.objectKey,
          namespace: stored.namespace,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: String(stored.size),
          extension: stored.extension || null,
          publicUrl: '',
          entityId: entityId || null,
          variant: stored.variant || null,
          metadata: {
            storageFileId: stored.fileId,
            thumbnails: stored.thumbnails ?? [],
          },
          isPublic: false,
        }),
      );
    } catch (err) {
      // Keep MinIO and DB in sync: roll back object if DB insert fails
      try {
        await this.storageService.delete(stored.bucket, stored.objectKey);
      } catch {
        /* ignore cleanup error */
      }
      throw err;
    }

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
        // inclusive end-of-day if date-only
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.dateTo.trim())) {
          to.setHours(23, 59, 59, 999);
        }
        qb.andWhere('f.createdAt <= :dateTo', { dateTo: to });
      }
    }

    if (sortBy === 'size') {
      // size stored as varchar/bigint string
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

    // Verify each object still exists in MinIO; drop DB orphans
    const data: ReturnType<AdminMediaService['toDto']>[] = [];
    for (const file of rows) {
      try {
        await this.storageService.getMetadata(file.bucket, file.objectKey);
        const accessUrl = await this.storageService.getPresignedUrl(
          file.bucket,
          file.objectKey,
          3600,
        );
        data.push(this.toDto(file, accessUrl));
      } catch {
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

  async getAccessUrl(uuid: string, expirySeconds = 3600) {
    const file = await this.findByUuid(uuid);
    // Ensure object exists in MinIO before issuing URL
    try {
      await this.storageService.getMetadata(file.bucket, file.objectKey);
    } catch {
      await this.fileRepository.softRemove(file);
      throw new NotFoundException('File missing in storage.');
    }
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
    const file = await this.findByUuid(uuid);
    try {
      const stream = await this.storageService.getObjectStream(
        file.bucket,
        file.objectKey,
      );
      return { file, stream };
    } catch {
      await this.fileRepository.softRemove(file);
      throw new NotFoundException('File missing in storage.');
    }
  }

  async remove(uuid: string) {
    const file = await this.findByUuid(uuid);
    let minioDeleted = false;
    try {
      await this.storageService.delete(file.bucket, file.objectKey);
      minioDeleted = true;
    } catch {
      // If already gone from MinIO, still clean DB
      minioDeleted = true;
    }
    if (minioDeleted) {
      await this.fileRepository.softRemove(file);
    }
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

  private async findByUuid(uuid: string) {
    const file = await this.fileRepository.findOne({ where: { uuid } });
    if (!file) throw new NotFoundException('File not found.');
    return file;
  }
}
