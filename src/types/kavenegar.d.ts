declare module 'kavenegar' {
  export interface KavenegarApiOptions {
    apikey: string;
  }

  export interface VerifyLookupParams {
    receptor: string;
    token: string;
    token2?: string;
    token3?: string;
    token10?: string;
    token20?: string;
    template: string;
    type?: string;
  }

  export interface KavenegarApiClient {
    VerifyLookup(
      params: VerifyLookupParams,
      callback: (response: unknown, status: number, message?: string) => void,
    ): void;
    Send(
      params: {
        receptor: string;
        message: string;
        sender?: string;
      },
      callback: (response: unknown, status: number, message?: string) => void,
    ): void;
  }

  export function KavenegarApi(options: KavenegarApiOptions): KavenegarApiClient;
}
