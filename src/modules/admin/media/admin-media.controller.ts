import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { RoleSlug } from 'src/entities';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { StorageNamespace } from 'src/storage/storage.constants';
import { AdminMediaService } from './admin-media.service';

@ApiTags('admin-media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly mediaService: AdminMediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload private media to MinIO' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        namespace: { type: 'string', example: 'products' },
        entityId: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('namespace') namespace?: string,
    @Query('entityId') entityId?: string,
  ) {
    const ns = (namespace || StorageNamespace.PRODUCTS) as StorageNamespace;
    return this.mediaService.upload(file, ns, entityId);
  }

  @Get('library')
  @ApiOperation({ summary: 'List media by namespace (DB + MinIO consistency)' })
  listLibrary(
    @Query('namespace') namespace?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.mediaService.list({
      namespace,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 24,
      q,
      sortBy,
      sortOrder,
      dateFrom,
      dateTo,
    });
  }

  @Get(':uuid/url')
  @ApiOperation({ summary: 'Get short-lived private access URL' })
  getUrl(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.mediaService.getAccessUrl(uuid);
  }

  @Get(':uuid/stream')
  @ApiOperation({ summary: 'Stream private file (admin only)' })
  async stream(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.mediaService.stream(uuid);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=60');
    stream.pipe(res);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete private media' })
  remove(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.mediaService.remove(uuid);
  }
}
