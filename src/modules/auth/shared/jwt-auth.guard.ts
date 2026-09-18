import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleSlug, User } from 'src/entities';
import { AccessTokenPayload } from './auth.types';
import { AUDIENCE_KEY, ROLES_KEY } from './roles.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractBearer(request);

    if (!token) {
      throw new UnauthorizedException('Access token is missing.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid access token type.');
    }

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

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive.');
    }

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
