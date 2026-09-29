import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Kavenegar from 'kavenegar';
import {
  SendOtpSmsInput,
  SmsProvider,
  SmsSendResult,
  VerifyLookupInput,
} from '../sms.types';

/**
 * Kavenegar VerifyLookup provider (Iran OTP / CRA-approved templates).
 *
 * Panel template example (must include لغو 11):
 *   رمز یک بار مصرف شما در لیون مود
 *   code : %token%
 *   لغو 11
 *
 * Register that text in Kavenegar under KAVENEGAR_OTP_TEMPLATE name.
 */
export class KavenegarSmsProvider implements SmsProvider {
  readonly name = 'kavenegar';
  private readonly logger = new Logger(KavenegarSmsProvider.name);
  private readonly api: ReturnType<typeof Kavenegar.KavenegarApi>;
  private readonly otpTemplate: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('KAVENEGAR_API_KEY', '').trim();
    if (!apiKey) {
      throw new Error('KAVENEGAR_API_KEY is required when SMS_PROVIDER=kavenegar');
    }
    this.api = Kavenegar.KavenegarApi({ apikey: apiKey });
    this.otpTemplate = this.config
      .get<string>('KAVENEGAR_OTP_TEMPLATE', 'liven-verification-code')
      .trim();
  }

  async sendOtp(input: SendOtpSmsInput): Promise<SmsSendResult> {
    return this.sendVerifyLookup({
      phone: input.phone,
      template: this.otpTemplate,
      token: input.code,
    });
  }

  async sendVerifyLookup(input: VerifyLookupInput): Promise<SmsSendResult> {
    const receptor = normalizeIranMobile(input.phone);
    if (!receptor) {
      return {
        status: 'failed',
        provider: this.name,
        message: 'Invalid Iranian mobile number',
      };
    }

    try {
      const { response, status, message } = await this.verifyLookupAsync({
        receptor,
        token: input.token,
        token2: input.token2,
        token3: input.token3,
        token10: input.token10,
        token20: input.token20,
        template: input.template,
      });

      // Kavenegar: 200 = success
      if (status === 200) {
        this.logger.log(
          `OTP sent via Kavenegar to=${maskPhone(receptor)} template=${input.template}`,
        );
        return {
          status: 'sent',
          provider: this.name,
          providerStatus: status,
          raw: response,
        };
      }

      this.logger.error(
        `Kavenegar VerifyLookup failed status=${status} msg=${message ?? '-'} to=${maskPhone(receptor)}`,
      );
      return {
        status: 'failed',
        provider: this.name,
        providerStatus: status,
        message: message || `Kavenegar status ${status}`,
        raw: response,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Kavenegar VerifyLookup error: ${msg}`);
      return {
        status: 'failed',
        provider: this.name,
        message: msg,
      };
    }
  }

  private verifyLookupAsync(
    params: Parameters<
      ReturnType<typeof Kavenegar.KavenegarApi>['VerifyLookup']
    >[0],
  ): Promise<{ response: unknown; status: number; message?: string }> {
    return new Promise((resolve, reject) => {
      try {
        this.api.VerifyLookup(params, (response, status, message) => {
          resolve({ response, status, message });
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

/** Accept 09xxxxxxxxx / 9xxxxxxxxx / +989xxxxxxxxx → 09xxxxxxxxx */
export function normalizeIranMobile(phone: string): string | null {
  let p = phone.trim().replace(/[\s-]/g, '');
  if (p.startsWith('+98')) p = `0${p.slice(3)}`;
  else if (p.startsWith('98') && p.length === 12) p = `0${p.slice(2)}`;
  else if (p.startsWith('9') && p.length === 10) p = `0${p}`;
  if (!/^09\d{9}$/.test(p)) return null;
  return p;
}

function maskPhone(phone: string): string {
  const p = phone.trim();
  if (p.length < 7) return '***';
  return `${p.slice(0, 4)}****${p.slice(-3)}`;
}
