import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importSPKI, jwtVerify } from 'jose';
import type { Request } from 'express';

/** Official Torob Ed25519 public key (Product API v3). */
const TOROB_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----`;

@Injectable()
export class TorobAuthGuard implements CanActivate {
  private keyPromise: Promise<CryptoKey> | null = null;

  constructor(private readonly config: ConfigService) {}

  private getPublicKey() {
    if (!this.keyPromise) {
      this.keyPromise = importSPKI(TOROB_PUBLIC_KEY_PEM, 'EdDSA');
    }
    return this.keyPromise;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip =
      this.config.get<string>('TOROB_SKIP_AUTH', 'false').toLowerCase() ===
      'true';
    if (skip) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = String(req.headers['x-torob-token'] || '').trim();
    if (!token) {
      throw new UnauthorizedException({ error: 'missing X-Torob-Token' });
    }

    const audience =
      this.config.get<string>('TOROB_API_AUDIENCE')?.trim() ||
      req.headers.host ||
      '';

    try {
      const key = await this.getPublicKey();
      await jwtVerify(token, key, {
        algorithms: ['EdDSA'],
        audience: audience || undefined,
      });
      return true;
    } catch {
      throw new UnauthorizedException({ error: 'invalid X-Torob-Token' });
    }
  }
}
