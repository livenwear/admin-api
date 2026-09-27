import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Setting } from 'src/entities';
import { Repository } from 'typeorm';

const TOKEN_KEY = 'emalls_connection_token';
const TIME_KEY = 'emalls_connection_time';
const CACHE_TTL_SEC = 3600;
const EMALLS_VALIDATE_URL = 'https://emalls.ir/swservice/wp_plugin.ashx';
const PLUGIN_VERSION = '1.3.0-liven';

@Injectable()
export class EmallsAuthService {
  private readonly logger = new Logger(EmallsAuthService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  get pluginVersion() {
    return PLUGIN_VERSION;
  }

  shopDomain(): string {
    const configured = this.config.get<string>('EMALLS_SHOP_DOMAIN')?.trim();
    if (configured) return configured.replace(/^www\./i, '');

    const site =
      this.config.get<string>('CUSTOMER_WEB_URL') || 'https://livenmode.ir';
    try {
      const host = new URL(site).hostname || '';
      return host.replace(/^www\./i, '');
    } catch {
      return 'livenmode.ir';
    }
  }

  skipAuth(): boolean {
    return (
      this.config.get<string>('EMALLS_SKIP_AUTH', 'false').toLowerCase() ===
      'true'
    );
  }

  private async getSetting(key: string): Promise<string | null> {
    const row = await this.settingRepo.findOne({ where: { key } });
    return row?.value ?? null;
  }

  private async setSetting(key: string, value: string) {
    let row = await this.settingRepo.findOne({ where: { key } });
    if (!row) {
      row = this.settingRepo.create({
        key,
        value,
        group: 'emalls',
        type: 'string',
      });
    } else {
      row.value = value;
    }
    await this.settingRepo.save(row);
  }

  /**
   * Validates Emalls token the same way as the official WooCommerce plugin:
   * POST https://emalls.ir/swservice/wp_plugin.ashx
   */
  async assertValidToken(token: string | undefined): Promise<{
    ok: boolean;
    needSession: boolean;
    error?: string;
  }> {
    if (this.skipAuth()) {
      return { ok: true, needSession: false };
    }

    const cleaned = String(token || '').trim();
    if (!cleaned) {
      return { ok: false, needSession: true, error: 'Invalid token' };
    }

    const cachedToken = await this.getSetting(TOKEN_KEY);
    const cachedTime = Number((await this.getSetting(TIME_KEY)) || 0);
    if (
      cachedToken === cleaned &&
      cachedTime > 0 &&
      Date.now() / 1000 - cachedTime < CACHE_TTL_SEC
    ) {
      return { ok: true, needSession: false };
    }

    const shop_domain = this.shopDomain();
    try {
      const body = new URLSearchParams({
        token: cleaned,
        shop_domain,
        version: PLUGIN_VERSION,
      });
      const res = await fetch(EMALLS_VALIDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      let parsed: { success?: boolean; message?: string } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        await this.setSetting(TOKEN_KEY, '---');
        return {
          ok: false,
          needSession: true,
          error: 'Invalid token validation response',
        };
      }

      if (parsed.success && parsed.message === 'the token is valid') {
        await this.setSetting(TOKEN_KEY, cleaned);
        await this.setSetting(TIME_KEY, String(Math.floor(Date.now() / 1000)));
        return { ok: true, needSession: true };
      }

      await this.setSetting(TOKEN_KEY, '---');
      return { ok: false, needSession: true, error: 'Invalid token' };
    } catch (err) {
      this.logger.warn(
        `Emalls token check failed: ${err instanceof Error ? err.message : err}`,
      );
      await this.setSetting(TOKEN_KEY, '---');
      return {
        ok: false,
        needSession: true,
        error: err instanceof Error ? err.message : 'token validation failed',
      };
    }
  }
}
