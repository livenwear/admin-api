import { Logger } from '@nestjs/common';
import {
  SendOtpSmsInput,
  SmsProvider,
  SmsSendResult,
  VerifyLookupInput,
} from '../sms.types';

/**
 * Dev / fallback provider — never hits the network.
 * OTP is logged for local testing when SMS_PROVIDER=console.
 */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async sendOtp(input: SendOtpSmsInput): Promise<SmsSendResult> {
    this.logger.warn(
      `[console-sms] OTP to=${maskPhone(input.phone)} purpose=${input.purpose ?? '-'} code=${input.code}`,
    );
    return {
      status: 'sent',
      provider: this.name,
      message: 'Logged to console (SMS_PROVIDER=console)',
    };
  }

  async sendVerifyLookup(input: VerifyLookupInput): Promise<SmsSendResult> {
    this.logger.warn(
      `[console-sms] VerifyLookup to=${maskPhone(input.phone)} template=${input.template} token=${input.token}`,
    );
    return {
      status: 'sent',
      provider: this.name,
      message: 'Logged to console (SMS_PROVIDER=console)',
    };
  }
}

function maskPhone(phone: string): string {
  const p = phone.trim();
  if (p.length < 7) return '***';
  return `${p.slice(0, 4)}****${p.slice(-3)}`;
}
