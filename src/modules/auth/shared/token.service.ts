import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { RefreshToken, User } from 'src/entities';
import {
  AccessTokenPayload,
  AuthAudience,
  AuthTokensResponse,
  AuthUserResponse,
  RefreshTokenPayload,
} from './auth.types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  get accessExpiresIn(): string {
    return this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
  }

  get refreshExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  getRoleSlugs(user: User): string[] {
    return (
      user.userRoles?.map((ur) => ur.role?.slug).filter(Boolean) ?? []
    ) as string[];
  }

  toAuthUser(user: User): AuthUserResponse {
    return {
      uuid: user.uuid,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      roles: this.getRoleSlugs(user),
    };
  }

  async issueTokens(
    user: User,
    audience: AuthAudience,
    meta?: {
      userAgent?: string;
      ipAddress?: string;
      impersonatedBy?: string;
    },
  ): Promise<AuthTokensResponse> {
    const roles = this.getRoleSlugs(user);
    const accessPayload: AccessTokenPayload = {
      sub: user.uuid,
      email: user.email,
      phone: user.phone,
      roles,
      audience,
      typ: 'access',
      ...(meta?.impersonatedBy
        ? { impersonatedBy: meta.impersonatedBy }
        : {}),
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: this.accessExpiresIn as any,
    });

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: user.uuid,
      jti,
      audience,
      typ: 'refresh',
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: this.refreshExpiresIn as any,
    });

    const expiresAt = this.addDuration(new Date(), this.refreshExpiresIn);
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        user,
        token: refreshToken,
        expiresAt,
        revokedAt: null,
        userAgent: meta?.userAgent ?? null,
        ipAddress: meta?.ipAddress ?? null,
      }),
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessExpiresIn,
    };
  }

  async refresh(
    rawRefreshToken: string,
    audience: AuthAudience,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ tokens: AuthTokensResponse; user: User }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        rawRefreshToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (payload.typ !== 'refresh' || payload.audience !== audience) {
      throw new UnauthorizedException('Invalid refresh token audience.');
    }

    const stored = await this.refreshTokenRepository.findOne({
      where: { token: rawRefreshToken },
      relations: ['user', 'user.userRoles', 'user.userRoles.role'],
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is revoked or expired.');
    }

    if (stored.user?.uuid !== payload.sub) {
      throw new UnauthorizedException('Refresh token mismatch.');
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepository.save(stored);

    const tokens = await this.issueTokens(stored.user, audience, meta);
    return { tokens, user: stored.user };
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const stored = await this.refreshTokenRepository.findOne({
      where: { token: rawRefreshToken },
    });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokenRepository.save(stored);
    }
  }

  private addDuration(from: Date, duration: string): Date {
    const match = /^(\d+)([smhd])$/i.exec(duration.trim());
    if (!match) {
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const ms =
      unit === 's'
        ? amount * 1000
        : unit === 'm'
          ? amount * 60 * 1000
          : unit === 'h'
            ? amount * 60 * 60 * 1000
            : amount * 24 * 60 * 60 * 1000;
    return new Date(from.getTime() + ms);
  }
}
