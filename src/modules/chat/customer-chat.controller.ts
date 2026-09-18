import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { ChatSenderRole, FileEntity, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SendChatMessageDto, StartChatDto } from './dto/chat.dto';

@ApiTags('customer-chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/chat')
export class CustomerChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly storageService: StorageService,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List my chat conversations (history)' })
  list(@CurrentUser() user: User) {
    return this.chatService.listCustomerConversations(user);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Start a new chat (only if none open/waiting)' })
  start(@CurrentUser() user: User, @Body() dto: StartChatDto) {
    return this.chatService.startConversation(user, dto.subject);
  }

  @Get('conversations/:uuid/messages')
  @ApiOperation({ summary: 'Messages for one of my conversations' })
  messages(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.customerListMessages(
      user,
      uuid,
      before,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send message (REST fallback / idempotent)' })
  async send(@CurrentUser() user: User, @Body() dto: SendChatMessageDto) {
    const result = await this.chatService.sendMessage({
      clientMsgId: dto.clientMsgId,
      body: dto.body,
      fileUuid: dto.fileUuid,
      replyToMessageUuid: dto.replyToMessageUuid,
      sender: user,
      senderRole: ChatSenderRole.CUSTOMER,
      conversationUuid: dto.conversationUuid || '',
    });
    this.chatGateway.fanOutMessage(null, result);
    return { success: true, data: result };
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload chat image (max 5MB, images only)' })
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
