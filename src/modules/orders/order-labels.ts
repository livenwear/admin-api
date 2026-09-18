import { OrderStatus, PaymentMethod, PaymentStatus } from 'src/entities';

export const ORDER_STATUS_FA: Record<string, string> = {
  [OrderStatus.PENDING]: 'ثبت‌شده',
  [OrderStatus.CONFIRMED]: 'تایید شده',
  [OrderStatus.PROCESSING]: 'در حال آماده‌سازی',
  [OrderStatus.SHIPPED]: 'ارسال شده',
  [OrderStatus.DELIVERED]: 'تحویل شده',
  [OrderStatus.CANCELLED]: 'لغو شده',
  [OrderStatus.REFUNDED]: 'مسترد شده',
};

export const PAYMENT_STATUS_FA: Record<string, string> = {
  [PaymentStatus.PENDING]: 'در انتظار پرداخت',
  [PaymentStatus.PAID]: 'پرداخت‌شده',
  [PaymentStatus.FAILED]: 'پرداخت ناموفق',
  [PaymentStatus.REFUNDED]: 'بازگشت وجه',
  [PaymentStatus.PARTIALLY_REFUNDED]: 'بازگشت جزئی',
};

export const PAYMENT_METHOD_FA: Record<string, string> = {
  [PaymentMethod.ONLINE]: 'درگاه بانکی',
  [PaymentMethod.BANK_TRANSFER]: 'کارت به کارت',
  [PaymentMethod.CARD]: 'کارت',
  [PaymentMethod.CASH_ON_DELIVERY]: 'پرداخت در محل',
  [PaymentMethod.WALLET]: 'کیف پول',
};

export type OrderStage = {
  key: string;
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'failed';
};

/** Progress stages for customer/admin order timeline */
export function buildOrderStages(input: {
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  awaitingCardReview?: boolean;
}): OrderStage[] {
  const { status, paymentStatus, paymentMethod, awaitingCardReview } = input;

  if (status === OrderStatus.CANCELLED || paymentStatus === PaymentStatus.FAILED) {
    return [
      { key: 'placed', label: 'ثبت سفارش', state: 'done' },
      { key: 'payment', label: 'پرداخت', state: 'failed' },
      { key: 'cancelled', label: 'لغو شده', state: 'current' },
    ];
  }

  if (status === OrderStatus.REFUNDED || paymentStatus === PaymentStatus.REFUNDED) {
    return [
      { key: 'placed', label: 'ثبت سفارش', state: 'done' },
      { key: 'payment', label: 'پرداخت', state: 'done' },
      { key: 'refunded', label: 'مسترد شده', state: 'current' },
    ];
  }

  const paid = paymentStatus === PaymentStatus.PAID;
  const isCard = paymentMethod === PaymentMethod.BANK_TRANSFER;
  const paymentLabel = isCard
    ? awaitingCardReview
      ? 'تایید فیش'
      : 'ارسال فیش'
    : 'پرداخت آنلاین';

  const keys = [
    'placed',
    'payment',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
  ] as const;
  const labels: Record<(typeof keys)[number], string> = {
    placed: 'ثبت سفارش',
    payment: paymentLabel,
    confirmed: 'تایید فروشگاه',
    processing: 'آماده‌سازی',
    shipped: 'ارسال',
    delivered: 'تحویل',
  };

  let currentIdx = 0;
  if (!paid) currentIdx = 1;
  else if (status === OrderStatus.PENDING || status === OrderStatus.CONFIRMED) {
    currentIdx = 2;
  } else if (status === OrderStatus.PROCESSING) currentIdx = 3;
  else if (status === OrderStatus.SHIPPED) currentIdx = 4;
  else if (status === OrderStatus.DELIVERED) currentIdx = 5;
  else currentIdx = paid ? 2 : 1;

  if (paid && status === OrderStatus.PENDING) currentIdx = 2;

  return keys.map((key, idx) => ({
    key,
    label: labels[key],
    state:
      idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'upcoming',
  }));
}

export function orderLabels(input: {
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  awaitingCardReview?: boolean;
  hasReceipt?: boolean;
}) {
  const method = input.paymentMethod || null;
  const methodFa = method ? PAYMENT_METHOD_FA[method] || method : null;
  const awaiting = Boolean(input.awaitingCardReview);
  const paid = input.paymentStatus === PaymentStatus.PAID;
  const failed = input.paymentStatus === PaymentStatus.FAILED;
  const pendingPay = input.paymentStatus === PaymentStatus.PENDING;

  /** Single primary badge for lists — avoids «در انتظار» + «در انتظار پرداخت» */
  let badgePrimary = ORDER_STATUS_FA[input.status] || input.status;
  let actionHint: string | null = null;

  if (failed) {
    badgePrimary = 'پرداخت ناموفق';
    actionHint = 'می‌توانید دوباره از سبد خرید سفارش دهید.';
  } else if (pendingPay && method === PaymentMethod.BANK_TRANSFER) {
    badgePrimary = awaiting ? 'در انتظار تایید فیش' : 'نیاز به ارسال فیش';
    actionHint = awaiting
      ? 'فیش واریزی دریافت شد و منتظر بررسی پشتیبانی است.'
      : 'مبلغ را کارت‌به‌کارت کنید، سپس تصویر یا PDF فیش را اینجا بارگذاری کنید.';
  } else if (pendingPay && method === PaymentMethod.ONLINE) {
    badgePrimary = 'در انتظار پرداخت آنلاین';
    actionHint = 'پرداخت را از طریق درگاه بانکی تکمیل کنید.';
  } else if (pendingPay) {
    badgePrimary = 'در انتظار پرداخت';
  } else if (paid) {
    badgePrimary = ORDER_STATUS_FA[input.status] || input.status;
  }

  return {
    status: ORDER_STATUS_FA[input.status] || input.status,
    paymentStatus:
      PAYMENT_STATUS_FA[input.paymentStatus] || input.paymentStatus,
    paymentMethod: methodFa,
    /** Preferred single status for order lists */
    badgePrimary,
    /** Payment channel chip */
    badgeMethod: methodFa,
    actionHint,
    stages: buildOrderStages({
      status: input.status,
      paymentStatus: input.paymentStatus,
      paymentMethod: method,
      awaitingCardReview: awaiting,
    }),
  };
}
