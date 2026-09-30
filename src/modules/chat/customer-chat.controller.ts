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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { assertChatAttachment } from 'src/common/utils/chat-attachment';
import { ChatSenderRole, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { StorageNamespace } from 'src/storage/storage.constants';
import { MediaFilesService } from 'src/storage/media-files.service';
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
    private readonly mediaFiles: MediaFilesService,
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

  @Get('conversations/:uuid/files/:fileUuid')
  @ApiOperation({ summary: 'Download a chat file I am allowed to see' })
  async downloadFile(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Param('fileUuid', ParseUUIDPipe) fileUuid: string,
    @Res() res: Response,
  ) {
    const file = await this.chatService.getFileInConversation(
      uuid,
      fileUuid,
      user.id,
    );
    const stream = await this.storageService.getObjectStream(
      file.bucket,
      file.objectKey,
    );
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName || 'file')}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    stream.pipe(res);
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
    const row = await this.mediaFiles.persistUploaded(stored, {
      entityId: user.uuid,
      metadata: { chatUpload: true },
    });
    return {
      success: true,
      data: {
        uuid: row.uuid,
        originalName: row.originalName,
        mimeType: row.mimeType,
        imageUrl: null,
      },
    };
  }
}
