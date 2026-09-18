import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

interface OtpRecord {
  code: string;
  expiresAt: Date;
  purpose: 'login' | 'register';
}

/**
 * Temporary in-memory OTP store.
 * Replace with Redis / DB + real SMS provider later.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, OtpRecord>();

  constructor(private readonly configService: ConfigService) {}

  private get ttlSeconds(): number {
    return Number(this.configService.get<string>('OTP_EXPIRES_SECONDS', '120'));
  }

  private get codeLength(): number {
    return Number(this.configService.get<string>('OTP_LENGTH', '6'));
  }

  generateCode(): string {
    const max = 10 ** this.codeLength;
    const min = 10 ** (this.codeLength - 1);
    return String(randomInt(min, max));
  }

  /**
   * Creates OTP and "sends" SMS.
   * SMS provider is NOT wired yet — code is logged only.
   */
  async requestOtp(
    phone: string,
    purpose: 'login' | 'register',
  ): Promise<{ expiresIn: number; debugNote: string }> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    this.store.set(phone, { code, expiresAt, purpose });

    // ---------------------------------------------------------------------------
    // TODO: integrate real SMS provider (Kavenegar / Ghasedak / etc.)
    // await this.smsProvider.send({ to: phone, template: 'otp', token: code });
    // ---------------------------------------------------------------------------
    this.logger.log(
      `[SMS-STUB] purpose=${purpose} phone=${phone} otp=${code} expiresIn=${this.ttlSeconds}s`,
    );

    return {
      expiresIn: this.ttlSeconds,
      debugNote:
        'SMS provider not configured — OTP printed to server logs only.',
    };
  }

  verifyOtp(phone: string, code: string): boolean {
    const record = this.store.get(phone);
    if (!record) return false;
    if (record.expiresAt < new Date()) {
      this.store.delete(phone);
      return false;
    }
    if (record.code !== code) return false;
    this.store.delete(phone);
    return true;
  }
}
