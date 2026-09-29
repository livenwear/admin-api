import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SendOtpSmsInput,
  SMS_PROVIDER,
  SmsProvider,
  SmsSendResult,
  VerifyLookupInput,
} from './sms.types';

/**
 * Application facade over the active SmsProvider.
 * Auth / OTP code should only depend on this class — never on Kavenegar directly.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(SMS_PROVIDER)
    private readonly provider: SmsProvider,
  ) {
    this.logger.log(`SMS provider active: ${this.provider.name}`);
  }

  get providerName(): string {
    return this.provider.name;
  }

  /** Iran-compliant OTP SMS (VerifyLookup / approved template). */
  async sendOtp(input: SendOtpSmsInput): Promise<SmsSendResult> {
    return this.provider.sendOtp(input);
  }

  /** Generic multi-token lookup (1–3+ tokens) for future templates. */
  async sendVerifyLookup(input: VerifyLookupInput): Promise<SmsSendResult> {
    return this.provider.sendVerifyLookup(input);
  }

  async sendOtpSingle(
    mobile: string,
    token: string,
    template: string,
  ): Promise<SmsSendResult> {
    return this.sendVerifyLookup({ phone: mobile, token, template });
  }

  async sendOtpDouble(
    mobile: string,
    token: string,
    token2: string,
    template: string,
  ): Promise<SmsSendResult> {
    return this.sendVerifyLookup({
      phone: mobile,
      token,
      token2,
      template,
    });
  }

  async sendOtpTriple(
    mobile: string,
    token: string,
    token2: string,
    token3: string,
    template: string,
  ): Promise<SmsSendResult> {
    return this.sendVerifyLookup({
      phone: mobile,
      token,
      token2,
      token3,
      template,
    });
  }
}
