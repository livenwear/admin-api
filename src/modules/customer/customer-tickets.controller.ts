import {
  Body,
  Controller,
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
import type { Response } from 'express';
import { assertTicketAttachment } from 'src/common/utils/ticket-attachment';
import { FileEntity, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerTicketsService } from './customer-tickets.service';
import { CreateTicketDto, ReplyTicketDto } from './dto/ticket.dto';

@ApiTags('customer-tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/tickets')
export class CustomerTicketsController {
  constructor(
    private readonly ticketsService: CustomerTicketsService,
    private readonly storageService: StorageService,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my support tickets' })
  list(@CurrentUser() user: User) {
    return this.ticketsService.list(user);
  }

  @Post('upload')
  @ApiOperation({
    summary: 'Upload ticket attachment (image/pdf/word/excel, max 5MB)',
  })
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
    @Query('entityId') entityId?: string,
  ) {
    assertTicketAttachment(file);
    const stored = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype || 'application/octet-stream',
      {
        namespace: StorageNamespace.TICKETS,
        entityId: entityId || user.uuid,
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
        entityId: entityId || user.uuid,
        variant: stored.variant || null,
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

  @Get(':key')
  @ApiOperation({ summary: 'Get ticket thread' })
  get(@CurrentUser() user: User, @Param('key') key: string) {
    return this.ticketsService.get(user, key);
  }

  @Post()
  @ApiOperation({ summary: 'Create a support ticket' })
  create(@CurrentUser() user: User, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user, dto);
  }

  @Post(':key/messages')
  @ApiOperation({ summary: 'Reply to a ticket' })
  reply(
    @CurrentUser() user: User,
    @Param('key') key: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.ticketsService.reply(user, key, dto);
  }

  @Get(':key/files/:fileUuid')
  @ApiOperation({ summary: 'Download ticket attachment' })
  async downloadFile(
    @CurrentUser() user: User,
    @Param('key') key: string,
    @Param('fileUuid', ParseUUIDPipe) fileUuid: string,
    @Res() res: Response,
  ) {
    const file = await this.ticketsService.getFileMeta(user, key, fileUuid);
    const stream = await this.storageService.getObjectStream(
      file.bucket,
      file.objectKey,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=60');
    stream.pipe(res);
  }
}
