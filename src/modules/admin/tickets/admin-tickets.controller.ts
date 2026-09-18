import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { assertTicketAttachment } from 'src/common/utils/ticket-attachment';
import { FileEntity, RoleSlug, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { Repository } from 'typeorm';
import {
  AdminEditMessageDto,
  AdminUpdateTicketDto,
  ReplyTicketDto,
} from '../../customer/dto/ticket.dto';
import { AdminTicketsService } from './admin-tickets.service';

@ApiTags('admin-tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/tickets')
export class AdminTicketsController {
  constructor(
    private readonly ticketsService: AdminTicketsService,
    private readonly storageService: StorageService,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Ticket stats for dashboard' })
  async stats() {
    return { success: true, data: await this.ticketsService.getStats() };
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.ticketsService.list({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status: status || undefined,
      search: search || undefined,
    });
  }

  @Get(':uuid')
  get(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.ticketsService.get(uuid);
  }

  @Patch(':uuid')
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateTicketDto,
  ) {
    return this.ticketsService.update(uuid, dto);
  }

  @Post(':uuid/messages')
  reply(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.ticketsService.reply(user, uuid, dto);
  }

  @Patch(':uuid/messages/:messageUuid')
  editMessage(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Param('messageUuid', ParseUUIDPipe) messageUuid: string,
    @Body() dto: AdminEditMessageDto,
  ) {
    return this.ticketsService.editMessage(uuid, messageUuid, dto);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    assertTicketAttachment(file);
    const stored = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype || 'application/octet-stream',
      {
        namespace: StorageNamespace.TICKETS,
        entityId: user.uuid,
        generateThumbnails: false,
      },
    );
    const row = await this.fileRepo.save(
      this.fileRepo.create({
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        namespace: stored.namespace,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: String(stored.size),
        extension: stored.extension || null,
        publicUrl: '',
        entityId: user.uuid,
        variant: null,
        metadata: { storageFileId: stored.fileId, ticketUpload: true },
        isPublic: false,
      }),
    );
    return {
      success: true,
      data: {
        uuid: row.uuid,
        originalName: row.originalName,
        mimeType: row.mimeType,
        size: row.size,
      },
    };
  }

  @Get(':uuid/files/:fileUuid')
  async downloadFile(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Param('fileUuid', ParseUUIDPipe) fileUuid: string,
    @Res() res: Response,
  ) {
    const file = await this.ticketsService.getFileMeta(uuid, fileUuid);
    const stream = await this.storageService.getObjectStream(
      file.bucket,
      file.objectKey,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );
    stream.pipe(res);
  }
}
