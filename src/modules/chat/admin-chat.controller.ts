import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Repository } from 'typeorm';
import { assertChatAttachment } from 'src/common/utils/chat-attachment';
import { ChatSenderRole, FileEntity, RoleSlug, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PatchConversationDto, SendChatMessageDto } from './dto/chat.dto';

@ApiTags('admin-chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/chat')
export class AdminChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly storageService: StorageService,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  @Get('unread-count')
  @ApiOperation({ summary: 'Total unread chat messages for admins' })
  unreadCount() {
    return this.chatService.adminUnreadTotal();
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List live chat conversations' })
  list(
    @Query('q') q?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.listConversationsForAdmin({
      q,
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 40,
    });
  }

  @Get('conversations/:uuid')
  @ApiOperation({ summary: 'Conversation + customer profile/addresses' })
  detail(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.chatService.getConversationDetailForAdmin(uuid);
  }

  @Get('conversations/:uuid/messages')
  @ApiOperation({ summary: 'Messages for a conversation' })
  messages(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.adminListMessages(
      uuid,
      before,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('conversations/:uuid/messages')
  @ApiOperation({ summary: 'Admin reply (REST — reliable send)' })
  async send(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: SendChatMessageDto,
  ) {
    const result = await this.chatService.sendMessage({
      clientMsgId: dto.clientMsgId,
      body: dto.body,
      fileUuid: dto.fileUuid,
      replyToMessageUuid: dto.replyToMessageUuid,
      sender: user,
      senderRole: ChatSenderRole.ADMIN,
      conversationUuid: uuid,
    });
    this.chatGateway.fanOutMessage(null, result);
    return { success: true, data: result };
  }

  @Patch('conversations/:uuid')
  @ApiOperation({ summary: 'Change conversation status' })
  patch(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: PatchConversationDto,
  ) {
    return this.chatService.setConversationStatus(uuid, dto.status);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload chat image (max 5MB)' })
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
    assertChatAttachment(file);
    const stored = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype || 'image/jpeg',
      {
        namespace: StorageNamespace.CHAT,
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
        variant: stored.variant || null,
        metadata: { storageFileId: stored.fileId, chatUpload: true },
        isPublic: false,
      }),
    );
    return {
      success: true,
      data: {
        uuid: row.uuid,
        originalName: row.originalName,
        mimeType: row.mimeType,
        imageUrl: `/public/media/${row.uuid}`,
      },
    };
  }
}
