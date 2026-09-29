export type SmsSendStatus = 'sent' | 'failed' | 'skipped';

export interface SmsSendResult {
  status: SmsSendStatus;
  provider: string;
  /** Provider HTTP/status code when available */
  providerStatus?: number;
  message?: string;
  raw?: unknown;
}

export interface SendOtpSmsInput {
  phone: string;
  code: string;
  /** Optional purpose label for logging (login/register/reset) */
  purpose?: string;
}

export interface VerifyLookupInput {
  phone: string;
  template: string;
  token: string;
  token2?: string;
  token3?: string;
  token10?: string;
  token20?: string;
}

/**
 * Portable SMS backend. Swap implementations via SMS_PROVIDER env
 * without touching OtpService / auth flows.
 */
export interface SmsProvider {
  readonly name: string;
  sendOtp(input: SendOtpSmsInput): Promise<SmsSendResult>;
  sendVerifyLookup(input: VerifyLookupInput): Promise<SmsSendResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
