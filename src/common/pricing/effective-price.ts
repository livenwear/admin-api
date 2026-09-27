/**
 * Variant price schedule helpers.
 *
 * Model: many `prices` rows per variant. Each has `effectiveFrom`.
 * Effective (storefront) price at time T = among active rows with
 * effectiveFrom <= T, the one with latest effectiveFrom (then createdAt).
 */

export type PriceLike = {
  amount: string | number;
  compareAtAmount?: string | number | null;
  currency?: string;
  isActive?: boolean;
  effectiveFrom?: Date | string | null;
  createdAt?: Date | string | null;
  deletedAt?: Date | string | null;
  uuid?: string;
  id?: number;
};

function toTime(value: Date | string | null | undefined): number {
  if (value == null) return 0;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Active, non-deleted candidates that have already taken effect. */
export function pickEffectivePrice<T extends PriceLike>(
  prices: T[] | null | undefined,
  at: Date = new Date(),
): T | null {
  if (!prices?.length) return null;
  const atMs = at.getTime();

  const eligible = prices.filter((p) => {
    if (p.deletedAt) return false;
    if (p.isActive === false) return false;
    const from = toTime(p.effectiveFrom ?? p.createdAt);
    return from <= atMs;
  });

  if (!eligible.length) return null;

  eligible.sort((a, b) => {
    const fa = toTime(a.effectiveFrom ?? a.createdAt);
    const fb = toTime(b.effectiveFrom ?? b.createdAt);
    if (fb !== fa) return fb - fa;
    return toTime(b.createdAt) - toTime(a.createdAt);
  });

  return eligible[0];
}

export function priceAmounts(price: PriceLike | null | undefined): {
  amount: number | null;
  compareAtAmount: number | null;
  currency: string;
} {
  if (!price) {
    return { amount: null, compareAtAmount: null, currency: 'IRR' };
  }
  const amount = Number(price.amount);
  const compareRaw =
    price.compareAtAmount != null ? Number(price.compareAtAmount) : null;
  return {
    amount: Number.isFinite(amount) ? amount : null,
    compareAtAmount:
      compareRaw != null && Number.isFinite(compareRaw) ? compareRaw : null,
    currency: price.currency || 'IRR',
  };
}

/**
 * Min effective unit price across variants (storefront card / filters).
 */
export function minEffectiveVariantPrice(
  variants: Array<{ isActive?: boolean; prices?: PriceLike[] }> | null | undefined,
  at: Date = new Date(),
): {
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
} {
  let price: number | null = null;
  let compareAtPrice: number | null = null;
  let currency = 'IRR';

  for (const v of variants || []) {
    if (v.isActive === false) continue;
    const eff = pickEffectivePrice(v.prices, at);
    const amounts = priceAmounts(eff);
    if (amounts.amount == null) continue;
    if (price === null || amounts.amount < price) {
      price = amounts.amount;
      compareAtPrice = amounts.compareAtAmount;
      currency = amounts.currency;
    }
  }

  return { price, compareAtPrice, currency };
}

/**
 * SQL: effective amount for one variant (use inside correlated subquery).
 * Column names match TypeORM default camelCase quoted identifiers.
 */
export const SQL_VARIANT_EFFECTIVE_AMOUNT = `(
  SELECT prx.amount::numeric
  FROM prices prx
  WHERE prx.variant_id = pv.id
    AND prx."isActive" = true
    AND prx."deletedAt" IS NULL
    AND COALESCE(prx."effectiveFrom", prx."createdAt") <= NOW()
  ORDER BY COALESCE(prx."effectiveFrom", prx."createdAt") DESC, prx."createdAt" DESC
  LIMIT 1
)`;

/** Min effective price across active variants of product alias `p`. */
export const SQL_PRODUCT_MIN_EFFECTIVE_PRICE = `(
  SELECT COALESCE(MIN(eff.amt), 0)
  FROM product_variants pv
  CROSS JOIN LATERAL (
    SELECT prx.amount::numeric AS amt
    FROM prices prx
    WHERE prx.variant_id = pv.id
      AND prx."isActive" = true
      AND prx."deletedAt" IS NULL
      AND COALESCE(prx."effectiveFrom", prx."createdAt") <= NOW()
    ORDER BY COALESCE(prx."effectiveFrom", prx."createdAt") DESC, prx."createdAt" DESC
    LIMIT 1
  ) eff
  WHERE pv.product_id = p.id
    AND pv."isActive" = true
    AND pv."deletedAt" IS NULL
)`;

/** True if any active variant currently has compareAt > amount. */
export const SQL_PRODUCT_ON_SALE_EXISTS = `EXISTS (
  SELECT 1
  FROM product_variants pv2
  CROSS JOIN LATERAL (
    SELECT pr2.amount::numeric AS amt, pr2."compareAtAmount"::numeric AS cmp
    FROM prices pr2
    WHERE pr2.variant_id = pv2.id
      AND pr2."isActive" = true
      AND pr2."deletedAt" IS NULL
      AND COALESCE(pr2."effectiveFrom", pr2."createdAt") <= NOW()
    ORDER BY COALESCE(pr2."effectiveFrom", pr2."createdAt") DESC, pr2."createdAt" DESC
    LIMIT 1
  ) eff2
  WHERE pv2.product_id = p.id
    AND pv2."isActive" = true
    AND pv2."deletedAt" IS NULL
    AND eff2.cmp IS NOT NULL
    AND eff2.cmp > eff2.amt
)`;

export function sameMoney(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  const na = a == null || a === '' ? null : Number(a);
  const nb = b == null || b === '' ? null : Number(b);
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) < 0.0001;
}
