/**
 * Manual SMS smoke test:
 *   npx ts-node -r tsconfig-paths/register scripts/sms-smoke.ts 0912xxxxxxx
 *
 * Uses .env KAVENEGAR_* settings. Does not touch DB.
 */
import { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { KavenegarSmsProvider } from '../src/modules/sms/providers/kavenegar.sms-provider';

loadEnv({ path: resolve(__dirname, '../.env') });

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: npx ts-node -r tsconfig-paths/register scripts/sms-smoke.ts 09xxxxxxxxx');
    process.exit(1);
  }

  const config = new ConfigService(process.env);
  const provider = new KavenegarSmsProvider(config);
  const code = String(Math.floor(100000 + Math.random() * 900000));

  console.log(`Sending OTP via ${provider.name} → ${phone} code=${code}`);
  const result = await provider.sendOtp({ phone, code, purpose: 'smoke-test' });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'sent' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
