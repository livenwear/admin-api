import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleSlug, User } from 'src/entities';
import { AccessTokenPayload } from './auth.types';
import { AUDIENCE_KEY, ROLES_KEY } from './roles.decorator';

/**
 * Attaches `request.user` when a valid Bearer token is present.
 * Does not reject missing/invalid tokens (guest flows).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractBearer(request);
    if (!token) return true;

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      return true;
    }

    if (payload.typ !== 'access') return true;

    const requiredAudience = this.reflector.getAllAndOverride<
      'admin' | 'customer' | undefined
    >(AUDIENCE_KEY, [context.getHandler(), context.getClass()]);

    if (requiredAudience && payload.audience !== requiredAudience) {
      throw new ForbiddenException('Token audience is not allowed for this route.');
    }

    const user = await this.userRepository.findOne({
      where: { uuid: payload.sub },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user || !user.isActive) return true;

    const roleSlugs =
      user.userRoles?.map((ur) => ur.role?.slug).filter(Boolean) ?? [];

    const requiredRoles = this.reflector.getAllAndOverride<RoleSlug[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      requiredRoles?.length &&
      !roleSlugs.includes(RoleSlug.SUPER_ADMIN) &&
      !requiredRoles.some((role) => roleSlugs.includes(role))
    ) {
      throw new ForbiddenException(
        'Access denied: insufficient role permissions.',
      );
    }

    request.user = user;
    request.auth = payload;
    return true;
  }

  private extractBearer(request: any): string | null {
    const header = request.headers?.authorization as string | undefined;
    if (!header) return null;
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) return null;
    return token;
  }
}
