import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ChatConversationStatus } from 'src/entities';
import { CHAT_MAX_BODY_LENGTH } from 'src/modules/chat/chat.limits';

export class SendChatMessageDto {
  @IsUUID('4')
  clientMsgId: string;

  @IsOptional()
  @IsString()
  @MaxLength(CHAT_MAX_BODY_LENGTH)
  body?: string;

  @IsOptional()
  @IsUUID('4')
  fileUuid?: string;

  @IsOptional()
  @IsUUID('4')
  conversationUuid?: string;

  @IsOptional()
  @IsUUID('4')
  replyToMessageUuid?: string;
}

export class StartChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;
}

export class MarkChatReadDto {
  @IsUUID('4')
  conversationUuid: string;

  @IsOptional()
  @IsUUID('4')
  upToMessageUuid?: string;
}

export class PatchConversationDto {
  @IsIn([
    ChatConversationStatus.OPEN,
    ChatConversationStatus.WAITING,
    ChatConversationStatus.CLOSED,
  ])
  status: ChatConversationStatus;
}
