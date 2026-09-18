import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { ROLES_KEY } from './roles.decorator';
import { RoleSlug, UserRole } from 'src/common/type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private authService: AuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<UserRole[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest();
    const token = this.getTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException('Token is missing.');
    }

    try {
      const decoded: any = this.jwtService.verify(token);
      const user = await this.authService.getUserById(decoded.userUuid);

      if (!user) {
        throw new UnauthorizedException(
          'User not found with the provided token.',
        );
      }

      const roleSlugs =
        user.userRoles?.map((ur) => ur.role?.slug).filter(Boolean) ?? [];

      if (
        requiredRoles &&
        requiredRoles.length > 0 &&
        !roleSlugs.includes(RoleSlug.SUPER_ADMIN) &&
        !requiredRoles.some((role) => roleSlugs.includes(role))
      ) {
        throw new ForbiddenException(
          'Access denied: User does not have the required role.',
        );
      }

      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private getTokenFromCookie(request: any): string | null {
    return request.cookies ? request.cookies['authToken'] : null;
  }
}
