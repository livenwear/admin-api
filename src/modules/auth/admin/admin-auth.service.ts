import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { RoleSlug, User } from 'src/entities';
import { TokenService } from '../shared/token.service';
import { AdminLoginDto } from './dto/admin-auth.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly tokenService: TokenService,
  ) {}

  async login(
    dto: AdminLoginDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const roles = this.tokenService.getRoleSlugs(user);
    const isStaff =
      roles.includes(RoleSlug.ADMIN) || roles.includes(RoleSlug.SUPER_ADMIN);
    if (!isStaff) {
      throw new ForbiddenException('Admin access required.');
    }

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const tokens = await this.tokenService.issueTokens(user, 'admin', meta);
    return {
      success: true,
      message: 'Admin login successful',
      data: {
        user: this.tokenService.toAuthUser(user),
        ...tokens,
      },
    };
  }

  async refresh(
    refreshToken: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const { tokens, user } = await this.tokenService.refresh(
      refreshToken,
      'admin',
      meta,
    );

    const roles = this.tokenService.getRoleSlugs(user);
    const isStaff =
      roles.includes(RoleSlug.ADMIN) || roles.includes(RoleSlug.SUPER_ADMIN);
    if (!isStaff) {
      throw new ForbiddenException('Admin access required.');
    }

    return {
      success: true,
      message: 'Token refreshed',
      data: {
        user: this.tokenService.toAuthUser(user),
        ...tokens,
      },
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
    return { success: true, message: 'Logged out' };
  }
}
