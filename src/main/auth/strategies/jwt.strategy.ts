import { Injectable, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from 'src/common/type';
import { User } from '@liven/entities';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private authService: AuthService, // ✅ Inject AuthService instead of UserRepository
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<UserRole[]>(ROLES_KEY, context.getHandler());
    const request = context.switchToHttp().getRequest();
    const token = this.getTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException('Token is missing.');
    }

    try {
      // Verifying the JWT token
      const decoded: any = this.jwtService.verify(token);
console.log("decoded => ",decoded)
      // Fetch user information from the AuthService
      const user = await this.authService.getUserById(decoded.userUuid);

      if (!user) {
        throw new UnauthorizedException('User not found with the provided token.');
      }
      console.log("requiredRoles", requiredRoles)
      console.log("requiredRoles", user)

      // Check if the user has the required roles to access the route
      if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        throw new ForbiddenException('Access denied: User does not have the required role.');
      }

      // Attach the user information to the request object for further processing in the route handlers
      request.user = user;

      return true;
    } catch (error) {
      console.error('JWT verification failed:', error.message);

      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(error.message);
      }
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException(error.message);
      }

      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private getTokenFromCookie(request: any): string | null {
    return request.cookies ? request.cookies['authToken'] : null;
  }
}
