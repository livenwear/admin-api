export const CHECKOUT_SETTINGS_KEY = 'checkout.commerce';

export type ShippingMethodConfig = {
  /** Stable client id for editing */
  id: string;
  /** Unique slug used in orders */
  code: string;
  title: string;
  enabled: boolean;
  fee: number;
  tehranFee?: number | null;
  otherCitiesFee?: number | null;
  /** When true, fee resolves by Tehran vs other cities */
  useRegionPricing?: boolean;
  etaText: string;
  description?: string | null;
  logoFileUuid?: string | null;
  /** Optional public media path/uuid resolved at read time */
  logoUrl?: string | null;
};

export type CardTransferConfig = {
  enabled: boolean;
  cardNumber: string;
  cardHolderName: string;
  bankName: string;
  instructions: string;
};

export type OnlineGatewayConfig = {
  enabled: boolean;
  provider: 'simulator';
};

export type CheckoutCommerceSettings = {
  shippingMethods: ShippingMethodConfig[];
  cardTransfer: CardTransferConfig;
  onlineGateway: OnlineGatewayConfig;
};

function mid(seed: string) {
  return `sm_${seed}`;
}

export const DEFAULT_CHECKOUT_SETTINGS: CheckoutCommerceSettings = {
  shippingMethods: [
    {
      id: mid('tipax'),
      code: 'tipax',
      title: 'تیپاکس',
      enabled: true,
      fee: 95000,
      etaText: '۲ تا ۴ روز کاری',
      description: 'ارسال سریع با تیپاکس در سراسر کشور',
      logoFileUuid: null,
      logoUrl: null,
    },
    {
      id: mid('post'),
      code: 'post',
      title: 'پست ایران',
      enabled: true,
      fee: 65000,
      etaText: '۳ تا ۷ روز کاری',
      description: 'ارسال با پست پیشتاز جمهوری اسلامی ایران',
      logoFileUuid: null,
      logoUrl: null,
    },
    {
      id: mid('courier'),
      code: 'courier',
      title: 'ارسال پیک',
      enabled: true,
      fee: 110000,
      tehranFee: 85000,
      otherCitiesFee: 135000,
      useRegionPricing: true,
      etaText: '۱ تا ۲ روز کاری',
      description: 'پیک اختصاصی برای تهران و شهرستان‌ها',
      logoFileUuid: null,
      logoUrl: null,
    },
  ],
  cardTransfer: {
    enabled: true,
    cardNumber: '6037-9912-3456-7890',
    cardHolderName: 'شرکت لیون مود',
    bankName: 'بانک ملت',
    instructions:
      'مبلغ سفارش را به کارت زیر واریز کنید و تصویر رسید را بارگذاری نمایید. پس از تایید ادمین، سفارش قطعی می‌شود.',
  },
  onlineGateway: {
    enabled: true,
    provider: 'simulator',
  },
};

export function slugifyShippingCode(input: string) {
  const raw = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff-_]/gi, '')
    .replace(/-+/g, '-')
    .slice(0, 40);
  if (raw) return raw;
  return `ship-${Date.now().toString(36)}`;
}

export function resolveShippingFee(
  method: ShippingMethodConfig,
  province?: string | null,
): number {
  const isTehran = (province || '').includes('تهران');
  const useRegion =
    Boolean(method.useRegionPricing) ||
    method.code === 'courier' ||
    method.tehranFee != null ||
    method.otherCitiesFee != null;
  if (useRegion) {
    if (isTehran && method.tehranFee != null) {
      return Math.max(0, Number(method.tehranFee));
    }
    if (!isTehran && method.otherCitiesFee != null) {
      return Math.max(0, Number(method.otherCitiesFee));
    }
  }
  return Math.max(0, Number(method.fee) || 0);
}
