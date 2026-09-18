import { Injectable } from '@nestjs/common';
import { StorageService } from 'src/storage';
import { ListStorageFilesDto, UploadStorageFileDto } from './dto';

@Injectable()
export class StorageAdminService {
  constructor(private readonly storageService: StorageService) {}

  health() {
    return this.storageService.health();
  }

  getNamespaces() {
    return this.storageService.getNamespaces();
  }

  upload(file: Express.Multer.File, query: UploadStorageFileDto) {
    return this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        namespace: query.namespace,
        entityId: query.entityId,
        variant: query.variant,
        generateThumbnails: query.generateThumbnails,
      },
    );
  }

  list(query: ListStorageFilesDto) {
    return this.storageService.list({
      namespace: query.namespace,
      entityId: query.entityId,
      limit: query.limit,
    });
  }

  getMetadata(bucket: string, objectKey: string) {
    return this.storageService.getMetadata(bucket, objectKey);
  }

  delete(bucket: string, objectKey: string) {
    return this.storageService.delete(bucket, objectKey);
  }
}
