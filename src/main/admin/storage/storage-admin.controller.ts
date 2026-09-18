import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/main/auth/strategies/roles.decorator';
import { JwtAuthGuard } from 'src/main/auth/strategies/jwt.strategy';
import { UserRole } from 'src/common/type';
import { StorageAdminService } from './storage-admin.service';
import {
  DeleteStorageFileDto,
  ListStorageFilesDto,
  StorageFileMetadataDto,
  UploadStorageFileDto,
} from './dto';

@ApiTags('admin-storage')
@ApiBearerAuth()
@Controller('admin/storage')
@UseGuards(JwtAuthGuard)
export class StorageAdminController {
  constructor(private readonly storageAdminService: StorageAdminService) {}

  @Get('health')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Check MinIO storage health' })
  health() {
    return this.storageAdminService.health();
  }

  @Get('namespaces')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List storage namespaces and path patterns' })
  namespaces() {
    return this.storageAdminService.getNamespaces();
  }

  @Post('upload')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload file to MinIO' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadStorageFileDto,
  ): Promise<StorageFileMetadataDto> {
    if (!file) {
      throw new BadRequestException('No file provided. Use field name "file".');
    }
    return this.storageAdminService.upload(file, query);
  }

  @Get('files')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List files in a namespace' })
  list(@Query() query: ListStorageFilesDto) {
    return this.storageAdminService.list(query);
  }

  @Get('metadata')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get file metadata' })
  metadata(@Query() query: DeleteStorageFileDto) {
    return this.storageAdminService.getMetadata(query.bucket, query.objectKey);
  }

  @Delete('files')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a file and its thumbnails' })
  delete(@Query() query: DeleteStorageFileDto) {
    return this.storageAdminService.delete(query.bucket, query.objectKey);
  }
}
