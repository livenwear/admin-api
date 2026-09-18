import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FileEntity, Setting } from 'src/entities';
import { In, Repository } from 'typeorm';
import {
  CHECKOUT_SETTINGS_KEY,
  DEFAULT_CHECKOUT_SETTINGS,
  slugifyShippingCode,
  type CheckoutCommerceSettings,
  type ShippingMethodConfig,
} from './commerce-settings.types';
import { StorageNamespace } from 'src/storage/storage.constants';

function asNumber(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMethod(
  row: Partial<ShippingMethodConfig>,
  fallbackIndex: number,
): ShippingMethodConfig | null {
  const title = String(row.title || '').trim().slice(0, 80);
  if (!title) return null;
  const code = slugifyShippingCode(row.code || title);
  const id =
    String(row.id || '').trim() ||
    `sm_${code}_${fallbackIndex}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    code,
    title,
    enabled: row.enabled !== false,
    fee: Math.max(0, asNumber(row.fee, 0)),
    tehranFee:
      row.tehranFee == null ? null : Math.max(0, asNumber(row.tehranFee, 0)),
    otherCitiesFee:
      row.otherCitiesFee == null
        ? null
        : Math.max(0, asNumber(row.otherCitiesFee, 0)),
    useRegionPricing: Boolean(row.useRegionPricing),
    etaText: String(row.etaText || '۲ تا ۵ روز کاری').slice(0, 120),
    description:
      row.description == null ? null : String(row.description).slice(0, 300),
    logoFileUuid: row.logoFileUuid ? String(row.logoFileUuid) : null,
    logoUrl: null,
  };
}

function normalizeSettings(raw: unknown): CheckoutCommerceSettings {
  const base = structuredClone(DEFAULT_CHECKOUT_SETTINGS);
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<CheckoutCommerceSettings>;

  if (Array.isArray(input.shippingMethods)) {
    const methods: ShippingMethodConfig[] = [];
    const usedCodes = new Set<string>();
    input.shippingMethods.forEach((row, idx) => {
      const m = normalizeMethod(row || {}, idx);
      if (!m) return;
      let code = m.code;
      let n = 2;
      while (usedCodes.has(code)) {
        code = `${m.code}-${n++}`;
      }
      usedCodes.add(code);
      methods.push({ ...m, code });
    });
    if (methods.length) base.shippingMethods = methods;
  }

  if (input.cardTransfer && typeof input.cardTransfer === 'object') {
    base.cardTransfer = {
      enabled: Boolean(input.cardTransfer.enabled),
      cardNumber: String(input.cardTransfer.cardNumber || '').slice(0, 40),
      cardHolderName: String(input.cardTransfer.cardHolderName || '').slice(
        0,
        120,
      ),
      bankName: String(input.cardTransfer.bankName || '').slice(0, 80),
      instructions: String(input.cardTransfer.instructions || '').slice(0, 800),
    };
  }

  if (input.onlineGateway && typeof input.onlineGateway === 'object') {
    base.onlineGateway = {
      enabled: Boolean(input.onlineGateway.enabled),
      provider: 'simulator',
    };
  }

  return base;
}

@Injectable()
export class CommerceSettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  private async withLogos(
    settings: CheckoutCommerceSettings,
  ): Promise<CheckoutCommerceSettings> {
    const uuids = settings.shippingMethods
      .map((m) => m.logoFileUuid)
      .filter(Boolean) as string[];
    if (!uuids.length) return settings;
    const files = await this.fileRepo.find({ where: { uuid: In(uuids) } });

    // Ensure logos are publicly streamable on the storefront
    const toPromote = files.filter(
      (f) => f.namespace !== StorageNamespace.SHIPPING || !f.isPublic,
    );
    if (toPromote.length) {
      for (const f of toPromote) {
        f.namespace = StorageNamespace.SHIPPING;
        f.isPublic = true;
      }
      await this.fileRepo.save(toPromote);
    }

    const map = new Map(files.map((f) => [f.uuid, f.uuid]));
    return {
      ...settings,
      shippingMethods: settings.shippingMethods.map((m) => ({
        ...m,
        logoUrl:
          m.logoFileUuid && map.has(m.logoFileUuid)
            ? `/public/media/${m.logoFileUuid}`
            : null,
      })),
    };
  }

  async get(): Promise<CheckoutCommerceSettings> {
    const row = await this.settingRepo.findOne({
      where: { key: CHECKOUT_SETTINGS_KEY },
    });
    let settings: CheckoutCommerceSettings;
    if (!row?.value) {
      settings = structuredClone(DEFAULT_CHECKOUT_SETTINGS);
    } else {
      try {
        settings = normalizeSettings(JSON.parse(row.value));
      } catch {
        settings = structuredClone(DEFAULT_CHECKOUT_SETTINGS);
      }
    }
    return this.withLogos(settings);
  }

  async save(patch: {
    shippingMethods?: Array<Partial<ShippingMethodConfig>>;
    cardTransfer?: Partial<CheckoutCommerceSettings['cardTransfer']>;
    onlineGateway?: { enabled?: boolean; provider?: 'simulator' };
  }): Promise<CheckoutCommerceSettings> {
    const current = await this.get();
    if (patch.shippingMethods) {
      const normalized = normalizeSettings({
        shippingMethods: patch.shippingMethods,
      }).shippingMethods;
      if (!normalized.length) {
        throw new BadRequestException('حداقل یک روش ارسال لازم است.');
      }
    }

    const next = normalizeSettings({
      ...current,
      shippingMethods: patch.shippingMethods ?? current.shippingMethods,
      cardTransfer: patch.cardTransfer
        ? { ...current.cardTransfer, ...patch.cardTransfer }
        : current.cardTransfer,
      onlineGateway: patch.onlineGateway
        ? {
            ...current.onlineGateway,
            enabled: Boolean(patch.onlineGateway.enabled),
            provider: 'simulator' as const,
          }
        : current.onlineGateway,
    });

    // strip resolved logoUrl before persist
    const toStore: CheckoutCommerceSettings = {
      ...next,
      shippingMethods: next.shippingMethods.map((m) => ({
        ...m,
        logoUrl: null,
      })),
    };

    let row = await this.settingRepo.findOne({
      where: { key: CHECKOUT_SETTINGS_KEY },
    });
    if (!row) {
      row = this.settingRepo.create({
        key: CHECKOUT_SETTINGS_KEY,
        group: 'checkout',
        type: 'json',
        value: JSON.stringify(toStore),
      });
    } else {
      row.value = JSON.stringify(toStore);
      row.type = 'json';
      row.group = 'checkout';
    }
    await this.settingRepo.save(row);
    return this.withLogos(next);
  }

  async getEnabledShippingMethods(): Promise<ShippingMethodConfig[]> {
    const settings = await this.get();
    return settings.shippingMethods.filter((m) => m.enabled);
  }

  async getShippingMethod(
    code: string,
  ): Promise<ShippingMethodConfig | null> {
    const settings = await this.get();
    return (
      settings.shippingMethods.find((m) => m.code === code && m.enabled) ||
      null
    );
  }
}
