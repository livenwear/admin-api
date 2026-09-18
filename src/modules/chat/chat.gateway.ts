import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import {
  ChatSenderRole,
  RoleSlug,
  User,
} from 'src/entities';
import { AccessTokenPayload } from 'src/modules/auth/shared/auth.types';
import { ChatService } from './chat.service';
import { ConfigService } from '@nestjs/config';
import { CHAT_SOCKET_MAX_PER_SEC, sanitizeChatBody } from './chat.limits';

type SocketMeta = {
  user: User;
  audience: 'customer' | 'admin';
  conversationUuid?: string;
};

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  /** userUuid -> set of socket ids (customers only for online count) */
  private readonly customerSockets = new Map<string, Set<string>>();
  /** admin sockets count for support online */
  private readonly adminSockets = new Map<string, Set<string>>();
  private readonly meta = new WeakMap<Socket, SocketMeta>();
  /** soft rate limit: socketId -> timestamps */
  private readonly sendTimes = new Map<string, number[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization || '')
          .replace(/^Bearer\s+/i, '')
          .trim();

      if (!token) {
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.configService.get<string>('JWT_SECRET_KEY'),
        },
      );

      if (payload.typ !== 'access') {
        client.disconnect(true);
        return;
      }
      if (payload.audience !== 'customer' && payload.audience !== 'admin') {
        client.disconnect(true);
        return;
      }

      const user = await this.userRepo.findOne({
        where: { uuid: payload.sub },
        relations: ['userRoles', 'userRoles.role'],
      });
      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      if (payload.audience === 'admin') {
        const roles =
          user.userRoles?.map((ur) => ur.role?.slug).filter(Boolean) || [];
        if (
          !roles.includes(RoleSlug.ADMIN) &&
          !roles.includes(RoleSlug.SUPER_ADMIN)
        ) {
          client.disconnect(true);
          return;
        }
      }

      this.meta.set(client, { user, audience: payload.audience });
      client.join(`user:${user.uuid}`);

      if (payload.audience === 'customer') {
        this.addPresence(this.customerSockets, user.uuid, client.id);
        const list = await this.chatService.listCustomerConversations(user);
        const activeUuid = list.meta.activeUuid as string | null;
        if (activeUuid) {
          client.join(`conversation:${activeUuid}`);
          this.meta.get(client)!.conversationUuid = activeUuid;
        }
        client.emit('conversations:list', list);
        client.emit('presence:support', {
          online: this.adminOnlineCount() > 0,
        });
        this.broadcastOnlineCount();
      } else {
        this.addPresence(this.adminSockets, user.uuid, client.id);
        client.join('admin:inbox');
        client.emit('presence:online_count', {
          customersOnline: this.customersOnlineCount(),
        });
        this.broadcastSupportPresence();
      }
    } catch (err) {
      this.logger.warn(`Chat socket auth failed: ${String(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const info = this.meta.get(client);
    this.sendTimes.delete(client.id);
    if (!info) return;

    if (info.audience === 'customer') {
      this.removePresence(this.customerSockets, info.user.uuid, client.id);
      this.broadcastOnlineCount();
    } else {
      this.removePresence(this.adminSockets, info.user.uuid, client.id);
      this.broadcastSupportPresence();
    }
  }

  private addPresence(
    map: Map<string, Set<string>>,
    userUuid: string,
    socketId: string,
  ) {
    let set = map.get(userUuid);
    if (!set) {
      set = new Set();
      map.set(userUuid, set);
    }
    set.add(socketId);
  }

  private removePresence(
    map: Map<string, Set<string>>,
    userUuid: string,
    socketId: string,
  ) {
    const set = map.get(userUuid);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) map.delete(userUuid);
  }

  customersOnlineCount() {
    return this.customerSockets.size;
  }

  adminOnlineCount() {
    return this.adminSockets.size;
  }

  private broadcastOnlineCount() {
    this.server.to('admin:inbox').emit('presence:online_count', {
      customersOnline: this.customersOnlineCount(),
    });
  }

  private broadcastSupportPresence() {
    const online = this.adminOnlineCount() > 0;
    // customers are in conversation rooms + user rooms; emit broadly to customer sockets via each
    for (const [, sockets] of this.customerSockets) {
      for (const sid of sockets) {
        this.server.to(sid).emit('presence:support', { online });
      }
    }
  }

  private allowSend(socketId: string, maxPerSec = CHAT_SOCKET_MAX_PER_SEC) {
    const now = Date.now();
    const windowMs = 1000;
    const prev = (this.sendTimes.get(socketId) || []).filter(
      (t) => now - t < windowMs,
    );
    if (prev.length >= maxPerSec) {
      this.sendTimes.set(socketId, prev);
      return false;
    }
    prev.push(now);
    this.sendTimes.set(socketId, prev);
    return true;
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      clientMsgId?: string;
      body?: string;
      fileUuid?: string;
      conversationUuid?: string;
      replyToMessageUuid?: string;
    },
  ) {
    const info = this.meta.get(client);
    if (!info) return { ok: false, error: 'Unauthorized' };
    if (!this.allowSend(client.id)) {
      return { ok: false, error: 'Too many messages' };
    }

    const conversationUuid =
      body.conversationUuid || info.conversationUuid || '';
    if (!conversationUuid) {
      return { ok: false, error: 'conversationUuid required' };
    }

    try {
      const result = await this.chatService.sendMessage({
        clientMsgId: body.clientMsgId || '',
        body: sanitizeChatBody(body.body || ''),
        fileUuid: body.fileUuid,
        replyToMessageUuid: body.replyToMessageUuid,
        sender: info.user,
        senderRole:
          info.audience === 'customer'
            ? ChatSenderRole.CUSTOMER
            : ChatSenderRole.ADMIN,
        conversationUuid,
      });

      this.fanOutMessage(client, result);

      return { ok: true, message: result.message };
    } catch (err: any) {
      const message = err?.message || 'Send failed';
      client.emit('message:error', {
        clientMsgId: body.clientMsgId,
        message,
      });
      return { ok: false, error: message };
    }
  }

  /** Used by REST controllers so admin/customer HTTP sends still realtime-push */
  fanOutMessage(
    excludeClient: Socket | null,
    result: {
      message: any;
      conversation: any;
      created: boolean;
      read?: {
        messageUuids: string[];
        readAt: string;
        conversation: any;
      } | null;
    },
  ) {
    const convUuid = result.conversation.uuid;

    if (excludeClient) {
      excludeClient.emit('message:ack', {
        clientMsgId: result.message.clientMsgId,
        message: result.message,
        conversation: result.conversation,
        created: result.created,
      });
      excludeClient.to(`conversation:${convUuid}`).emit('message:new', {
        message: result.message,
        conversation: result.conversation,
      });
    } else {
      this.server.to(`conversation:${convUuid}`).emit('message:new', {
        message: result.message,
        conversation: result.conversation,
      });
    }

    this.server.to('admin:inbox').emit('conversation:updated', {
      conversation: result.conversation,
      message: result.message,
    });

    if (result.message.senderRole === ChatSenderRole.CUSTOMER) {
      this.server.to('admin:inbox').emit('message:new', {
        message: result.message,
        conversation: result.conversation,
      });
    } else if (result.conversation.customer?.uuid) {
      this.server
        .to(`user:${result.conversation.customer.uuid}`)
        .emit('message:new', {
          message: result.message,
          conversation: result.conversation,
        });
    }

    if (result.read?.messageUuids?.length) {
      const payload = {
        conversationUuid: convUuid,
        messageUuids: result.read.messageUuids,
        readAt: result.read.readAt,
        conversation: result.read.conversation || result.conversation,
      };
      this.server.to(`conversation:${convUuid}`).emit('message:read', payload);
      this.server.to('admin:inbox').emit('message:read', payload);
      if (result.conversation.customer?.uuid) {
        this.server
          .to(`user:${result.conversation.customer.uuid}`)
          .emit('message:read', payload);
      }
    }
  }

  @SubscribeMessage('conversation:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationUuid?: string },
  ) {
    const info = this.meta.get(client);
    if (!info || !body.conversationUuid) return { ok: false };

    try {
      if (info.audience === 'customer') {
        await this.chatService.assertCustomerOwns(
          info.user,
          body.conversationUuid,
        );
      } else {
        await this.chatService.getConversationByUuid(body.conversationUuid);
      }

      if (info.conversationUuid) {
        client.leave(`conversation:${info.conversationUuid}`);
      }
      client.join(`conversation:${body.conversationUuid}`);
      info.conversationUuid = body.conversationUuid;

      if (info.audience === 'admin') {
        const result = await this.chatService.markRead({
          conversationUuid: body.conversationUuid,
          readerRole: ChatSenderRole.ADMIN,
          reader: info.user,
        });
        if (result.messageUuids.length) {
          this.server
            .to(`conversation:${body.conversationUuid}`)
            .emit('message:read', {
              conversationUuid: body.conversationUuid,
              messageUuids: result.messageUuids,
              readAt: result.readAt,
              conversation: result.conversation,
            });
          this.server.to('admin:inbox').emit('conversation:updated', {
            conversation: result.conversation,
          });
        }
        return { ok: true, conversation: result.conversation };
      }

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { conversationUuid?: string; upToMessageUuid?: string },
  ) {
    const info = this.meta.get(client);
    if (!info) return { ok: false };

    const conversationUuid =
      body.conversationUuid || info.conversationUuid;
    if (!conversationUuid) return { ok: false, error: 'conversation required' };

    try {
      const result = await this.chatService.markRead({
        conversationUuid,
        readerRole:
          info.audience === 'customer'
            ? ChatSenderRole.CUSTOMER
            : ChatSenderRole.ADMIN,
        reader: info.user,
        upToMessageUuid: body.upToMessageUuid,
      });

      const payload = {
        conversationUuid,
        messageUuids: result.messageUuids,
        readAt: result.readAt,
        conversation: result.conversation,
      };

      this.server
        .to(`conversation:${conversationUuid}`)
        .emit('message:read', payload);
      this.server.to('admin:inbox').emit('conversation:updated', {
        conversation: result.conversation,
      });

      return { ok: true, ...payload };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'read failed' };
    }
  }

  @SubscribeMessage('conversation:leave')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationUuid?: string },
  ) {
    const info = this.meta.get(client);
    if (!info) return { ok: false };
    const uuid = body.conversationUuid || info.conversationUuid;
    if (uuid) {
      client.leave(`conversation:${uuid}`);
      if (info.conversationUuid === uuid) info.conversationUuid = undefined;
    }
    return { ok: true };
  }

  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationUuid?: string },
  ) {
    const info = this.meta.get(client);
    if (!info) return;
    const uuid =
      body.conversationUuid ||
      info.conversationUuid;
    if (!uuid) return;
    client.to(`conversation:${uuid}`).emit('typing', {
      conversationUuid: uuid,
      userUuid: info.user.uuid,
      audience: info.audience,
      typing: true,
      name: `${info.user.firstName || ''}`.trim(),
    });
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationUuid?: string },
  ) {
    const info = this.meta.get(client);
    if (!info) return;
    const uuid = body.conversationUuid || info.conversationUuid;
    if (!uuid) return;
    client.to(`conversation:${uuid}`).emit('typing', {
      conversationUuid: uuid,
      userUuid: info.user.uuid,
      audience: info.audience,
      typing: false,
    });
  }
}
