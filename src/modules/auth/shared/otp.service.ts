import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { OtpChannel, OtpDelivery, OtpPurpose, User } from 'src/entities';
import { AppSettingsService } from 'src/modules/settings/app-settings.service';
import { SmsService } from 'src/modules/sms/sms.service';
import { In, Repository } from 'typeorm';

interface ActiveOtp {
  code: string;
  expiresAt: Date;
  purpose: OtpPurpose;
  deliveryId: number;
}

export type OtpDeliveryView = {
  uuid: string;
  code: string;
  channel: OtpChannel;
  destination: string;
  purpose: OtpPurpose;
  status: 'active' | 'expired' | 'consumed';
  expiresAt: string;
  consumedAt: string | null;
  sentAt: string;
};

/**
 * OTP issue + verify.
 * Active codes stay in memory for fast verify; every send is persisted
 * to `otp_deliveries` for admin debugging / support.
 * SMS delivery goes through SmsService (provider-swappable).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, ActiveOtp>();

  constructor(
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly appSettings: AppSettingsService,
    @InjectRepository(OtpDelivery)
    private readonly deliveryRepo: Repository<OtpDelivery>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

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

  private storeKey(channel: OtpChannel, destination: string) {
    return `${channel}:${destination.trim()}`;
  }

  /**
   * Creates OTP, persists delivery row, and sends via configured SMS provider.
   */
  async requestOtp(
    destination: string,
    purpose: OtpPurpose,
    channel: OtpChannel = OtpChannel.SMS,
  ): Promise<{ expiresIn: number; debugNote: string; sent: boolean }> {
    const dest = destination.trim();
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    let userId: number | null = null;
    if (channel === OtpChannel.SMS) {
      const user = await this.userRepo.findOne({ where: { phone: dest } });
      userId = user?.id ?? null;
    } else {
      const user = await this.userRepo.findOne({ where: { email: dest } });
      userId = user?.id ?? null;
    }

    const delivery = await this.deliveryRepo.save(
      this.deliveryRepo.create({
        destination: dest,
        channel,
        code,
        purpose,
        expiresAt,
        consumedAt: null,
        userId,
      }),
    );

    this.store.set(this.storeKey(channel, dest), {
      code,
      expiresAt,
      purpose,
      deliveryId: delivery.id,
    });

    let sent = false;
    let debugNote = '';

    if (channel === OtpChannel.SMS) {
      const smsEnabled = await this.appSettings.isSmsSendingEnabled();
      if (!smsEnabled) {
        // Feature flag off: behave as success for the customer, skip provider cost.
        this.logger.warn(
          `[SMS-FLAG-OFF] OTP issued but not sent phone=${dest} purpose=${purpose} code=${code}`,
        );
        sent = true;
        debugNote =
          'ارسال پیامک از تنظیمات ادمین خاموش است — کد فقط در پنل ادمین قابل مشاهده است.';
      } else {
        const result = await this.smsService.sendOtp({
          phone: dest,
          code,
          purpose,
        });
        sent = result.status === 'sent';
        if (sent) {
          debugNote =
            result.provider === 'console'
              ? 'SMS provider=console — OTP logged on server (not sent to phone).'
              : `OTP SMS sent via ${result.provider}.`;
        } else {
          this.store.delete(this.storeKey(channel, dest));
          this.logger.error(
            `OTP SMS failed provider=${result.provider} status=${result.providerStatus ?? '-'} msg=${result.message ?? '-'}`,
          );
          throw new BadRequestException(
            result.message ||
              'ارسال پیامک ناموفق بود. چند لحظه دیگر دوباره تلاش کنید.',
          );
        }
      }
    } else {
      this.logger.log(
        `[EMAIL-STUB] purpose=${purpose} email=${dest} otp=${code} expiresIn=${this.ttlSeconds}s`,
      );
      debugNote =
        'Email provider not configured — OTP printed to server logs only.';
      sent = false;
    }

    return {
      expiresIn: this.ttlSeconds,
      debugNote,
      sent,
    };
  }

  async verifyOtp(
    destination: string,
    code: string,
    channel: OtpChannel = OtpChannel.SMS,
  ): Promise<boolean> {
    const key = this.storeKey(channel, destination.trim());
    const record = this.store.get(key);
    if (!record) return false;
    if (record.expiresAt < new Date()) {
      this.store.delete(key);
      return false;
    }
    if (record.code !== code) return false;

    this.store.delete(key);
    await this.deliveryRepo.update(
      { id: record.deliveryId },
      { consumedAt: new Date() },
    );
    return true;
  }

  async listForUser(
    user: {
      id: number;
      phone?: string | null;
      email?: string | null;
    },
    limit = 50,
  ): Promise<{ latest: OtpDeliveryView | null; history: OtpDeliveryView[] }> {
    const destinations: string[] = [];
    if (user.phone?.trim()) destinations.push(user.phone.trim());
    if (user.email?.trim()) destinations.push(user.email.trim());

    const where =
      destinations.length > 0
        ? [{ userId: user.id }, { destination: In(destinations) }]
        : [{ userId: user.id }];

    const rows = await this.deliveryRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      if (seen.has(r.uuid)) return false;
      seen.add(r.uuid);
      return true;
    });

    const now = Date.now();
    const mapped: OtpDeliveryView[] = unique.map((r) => {
      const expired = r.expiresAt.getTime() < now;
      const consumed = Boolean(r.consumedAt);
      let status: OtpDeliveryView['status'] = 'active';
      if (consumed) status = 'consumed';
      else if (expired) status = 'expired';

      return {
        uuid: r.uuid,
        code: r.code,
        channel: r.channel,
        destination: r.destination,
        purpose: r.purpose,
        status,
        expiresAt: r.expiresAt.toISOString(),
        consumedAt: r.consumedAt ? r.consumedAt.toISOString() : null,
        sentAt: r.createdAt.toISOString(),
      };
    });

    return {
      latest: mapped[0] ?? null,
      history: mapped,
    };
  }
}
