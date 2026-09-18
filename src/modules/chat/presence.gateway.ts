import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { RoleSlug, User } from 'src/entities';
import { AccessTokenPayload } from 'src/modules/auth/shared/auth.types';

export type PresenceUser = {
  uuid: string;
  firstName: string | null;
  lastName: string | null;
};

type SocketMeta = {
  userUuid: string;
  audience: 'customer' | 'admin';
};

/**
 * Lightweight presence only — JWT auth, no chat DB work.
 * Tracks logged-in customers with an open storefront tab.
 */
@WebSocketGateway({
  namespace: '/presence',
  cors: { origin: true, credentials: true },
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PresenceGateway.name);

  @WebSocketServer()
  server: Server;

  /** customer uuid -> socket ids */
  private readonly customerSockets = new Map<string, Set<string>>();
  private readonly customerMeta = new Map<string, PresenceUser>();
  private readonly meta = new WeakMap<Socket, SocketMeta>();
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        { secret: this.configService.get<string>('JWT_SECRET_KEY') },
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
        this.meta.set(client, { userUuid: user.uuid, audience: 'admin' });
        client.join('admin:presence');
        client.emit('presence:snapshot', this.buildPayload());
        return;
      }

      this.meta.set(client, { userUuid: user.uuid, audience: 'customer' });
      let set = this.customerSockets.get(user.uuid);
      if (!set) {
        set = new Set();
        this.customerSockets.set(user.uuid, set);
      }
      set.add(client.id);
      this.customerMeta.set(user.uuid, {
        uuid: user.uuid,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
      });
      this.scheduleBroadcast();
    } catch (err) {
      this.logger.warn(`Presence auth failed: ${String(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const info = this.meta.get(client);
    if (!info || info.audience !== 'customer') return;

    const set = this.customerSockets.get(info.userUuid);
    if (!set) return;
    set.delete(client.id);
    if (set.size === 0) {
      this.customerSockets.delete(info.userUuid);
      this.customerMeta.delete(info.userUuid);
    }
    this.scheduleBroadcast();
  }

  private buildPayload() {
    const users = [...this.customerMeta.values()].slice(0, 40);
    return {
      count: this.customerSockets.size,
      users,
    };
  }

  /** Debounce fan-out so reconnect storms stay cheap */
  private scheduleBroadcast() {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      this.server
        .to('admin:presence')
        .emit('presence:snapshot', this.buildPayload());
    }, 250);
  }
}
