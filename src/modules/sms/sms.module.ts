import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleSmsProvider } from './providers/console.sms-provider';
import { KavenegarSmsProvider } from './providers/kavenegar.sms-provider';
import { SmsService } from './sms.service';
import { SMS_PROVIDER, SmsProvider } from './sms.types';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SmsProvider => {
        const logger = new Logger('SmsModule');
        const requested = (
          config.get<string>('SMS_PROVIDER', 'kavenegar') || 'kavenegar'
        )
          .trim()
          .toLowerCase();
        const apiKey = (config.get<string>('KAVENEGAR_API_KEY') || '').trim();

        if (requested === 'console' || requested === 'stub' || requested === 'log') {
          logger.warn('SMS_PROVIDER=console — OTP will only be logged');
          return new ConsoleSmsProvider();
        }

        if (requested === 'kavenegar') {
          if (!apiKey) {
            logger.warn(
              'KAVENEGAR_API_KEY missing — falling back to console SMS provider',
            );
            return new ConsoleSmsProvider();
          }
          return new KavenegarSmsProvider(config);
        }

        logger.warn(
          `Unknown SMS_PROVIDER="${requested}" — falling back to console`,
        );
        return new ConsoleSmsProvider();
      },
    },
    SmsService,
  ],
  exports: [SmsService, SMS_PROVIDER],
})
export class SmsModule {}
