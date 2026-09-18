import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChatConversation,
  ChatMessage,
  FileEntity,
  User,
  Address,
} from 'src/entities';
import { StorageModule } from 'src/storage/storage.module';
import { AdminChatController } from './admin-chat.controller';
import { ChatGateway } from './chat.gateway';
import { PresenceGateway } from './presence.gateway';
import { ChatService } from './chat.service';
import { CustomerChatController } from './customer-chat.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatConversation,
      ChatMessage,
      FileEntity,
      User,
      Address,
    ]),
    StorageModule,
  ],
  controllers: [CustomerChatController, AdminChatController],
  providers: [ChatService, ChatGateway, PresenceGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
