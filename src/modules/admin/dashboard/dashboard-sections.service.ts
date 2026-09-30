import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Cart,
  CartItem,
  ChatConversation,
  ChatMessage,
  ChatSenderRole,
  Comment,
  Inventory,
  Order,
  Shipment,
  StockMovement,
  StockMovementType,
  WishlistItem,
  OrderItem,
  OrderStatus,
  OtpDelivery,
  OtpPurpose,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Post,
  PostStatus,
  Product,
  ProductStatus,
  Review,
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from 'src/entities';
import { Repository } from 'typeorm';
import {
  ORDER_STATUS_FA,
  PAYMENT_METHOD_FA,
  PAYMENT_STATUS_FA,
} from 'src/modules/orders/order-labels';
import {
  agoLabel,
  fillSeries,
  resolveRange,
  type BucketUnit,
  type DashboardRange,
} from './admin-dashboard.service';

export const DASHBOARD_SECTION_KEYS = [
  'logins',
  'products',
  'orders',
  'tickets',
  'mag',
  'comments',
  'chat',
  'payments',
  'inventory',
  'carts',
  'wishlist',
  'shipping',
] as const;

export type DashboardSectionKey = (typeof DASHBOARD_SECTION_KEYS)[number];

type BucketRow = { bucket: Date | string; count: string };
type StatKind = 'count' | 'money' | 'percent' | 'decimal';

type SectionStat = { label: string; value: number; kind: StatKind };
type SectionRow = { id: string; title: string; subtitle: string; meta: string };
type SectionSlice = { label: string; value: number };

type SectionPayload = {
  key: DashboardSectionKey;
  range: DashboardRange;
  unit: BucketUnit;
  chart: {
    title: string;
    hint: string;
    primaryLabel: string;
    secondaryLabel: string;
    points: { at: string; primary: number; secondary: number }[];
  };
  stats: SectionStat[];
  breakdownTitle: string;
  breakdown: SectionSlice[];
  listTitle: string;
  listHref: string;
  listLink: string;
  empty: string;
  rows: SectionRow[];
};

const PRODUCT_STATUS_FA: Record<string, string> = {
  [ProductStatus.ACTIVE]: 'فعال',
  [ProductStatus.DRAFT]: 'پیش‌نویس',
  [ProductStatus.ARCHIVED]: 'بایگانی',
};

const POST_STATUS_FA: Record<string, string> = {
  [PostStatus.PUBLISHED]: 'منتشرشده',
  [PostStatus.DRAFT]: 'پیش‌نویس',
  [PostStatus.ARCHIVED]: 'بایگانی',
};

const TICKET_STATUS_FA: Record<string, string> = {
  [TicketStatus.OPEN]: 'باز',
  [TicketStatus.PENDING]: 'در انتظار',
  [TicketStatus.ANSWERED]: 'پاسخ‌داده‌شده',
  [TicketStatus.CLOSED]: 'بسته',
};

const TICKET_PRIORITY_FA: Record<string, string> = {
  [TicketPriority.LOW]: 'کم',
  [TicketPriority.NORMAL]: 'عادی',
  [TicketPriority.HIGH]: 'بالا',
  [TicketPriority.URGENT]: 'فوری',
};

const TICKET_CATEGORY_FA: Record<string, string> = {
  [TicketCategory.ORDER]: 'سفارش',
  [TicketCategory.PAYMENT]: 'پرداخت',
  [TicketCategory.SHIPPING]: 'ارسال',
  [TicketCategory.RETURN]: 'مرجوعی',
  [TicketCategory.PRODUCT]: 'محصول',
  [TicketCategory.ACCOUNT]: 'حساب کاربری',
  [TicketCategory.OTHER]: 'سایر',
};

const OTP_PURPOSE_FA: Record<string, string> = {
  [OtpPurpose.LOGIN]: 'ورود',
  [OtpPurpose.REGISTER]: 'ثبت‌نام',
  [OtpPurpose.RESET_PASSWORD]: 'بازیابی رمز',
};

const CHAT_STATUS_FA: Record<string, string> = {
  open: 'باز',
  waiting: 'منتظر پاسخ',
  closed: 'بسته',
};

const MOVEMENT_FA: Record<string, string> = {
  [StockMovementType.IN]: 'ورود',
  [StockMovementType.OUT]: 'خروج',
  [StockMovementType.ADJUSTMENT]: 'اصلاح',
  [StockMovementType.TRANSFER]: 'انتقال',
  [StockMovementType.RETURN]: 'برگشت',
};

const MOVEMENT_REF_FA: Record<string, string> = {
  order: 'فروش',
  order_reserve: 'رزرو سفارش',
  order_release: 'آزادسازی رزرو',
};

const SHIP_METHOD_FA: Record<string, string> = {
  tipax: 'تیپاکس',
  post: 'پست',
  courier: 'پیک',
};

const SHIPMENT_STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  processing: 'آماده‌سازی',
  shipped: 'ارسال شده',
  in_transit: 'در مسیر',
  delivered: 'تحویل شده',
  returned: 'مرجوع',
  failed: 'ناموفق',
};

@Injectable()
export class DashboardSectionsService {
  constructor(
    @InjectRepository(OtpDelivery)
    private readonly otpRepository: Repository<OtpDelivery>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(ChatConversation)
    private readonly chatRepository: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(WishlistItem)
    private readonly wishlistItemRepository: Repository<WishlistItem>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
  ) {}

  async get(key: string, range: DashboardRange) {
    if (!DASHBOARD_SECTION_KEYS.includes(key as DashboardSectionKey)) {
      throw new BadRequestException('بخش داشبورد نامعتبر است.');
    }
    const now = new Date();
    const window = resolveRange(range, now);
    const section = key as DashboardSectionKey;
    const data = await this.build(section, range, window, now);
    return { success: true, data };
  }

  private build(
    key: DashboardSectionKey,
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    switch (key) {
      case 'logins':
        return this.logins(range, window, now);
      case 'products':
        return this.products(range, window, now);
      case 'orders':
        return this.orders(range, window, now);
      case 'tickets':
        return this.tickets(range, window, now);
      case 'mag':
        return this.magazine(range, window, now);
      case 'comments':
        return this.comments(range, window, now);
      case 'chat':
        return this.chat(range, window, now);
      case 'payments':
        return this.payments(range, window, now);
      case 'inventory':
        return this.inventory(range, window, now);
      case 'carts':
        return this.carts(range, window, now);
      case 'wishlist':
        return this.wishlist(range, window, now);
      case 'shipping':
        return this.shipping(range, window, now);
    }
  }

  private async logins(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [sent, consumed, expired, pending, byPurpose, sentSeries, consumedSeries, recent] =
      await Promise.all([
        this.otpRepository
          .createQueryBuilder('otp')
          .where('otp.createdAt >= :start', { start })
          .getCount(),
        this.otpRepository
          .createQueryBuilder('otp')
          .where('otp.consumedAt >= :start', { start })
          .getCount(),
        this.otpRepository
          .createQueryBuilder('otp')
          .where('otp.createdAt >= :start', { start })
          .andWhere('otp.consumedAt IS NULL')
          .andWhere('otp.expiresAt < :now', { now })
          .getCount(),
        this.otpRepository
          .createQueryBuilder('otp')
          .where('otp.createdAt >= :start', { start })
          .andWhere('otp.consumedAt IS NULL')
          .andWhere('otp.expiresAt >= :now', { now })
          .getCount(),
        this.grouped(this.otpRepository, 'otp', 'purpose', start),
        this.buckets(this.otpRepository, 'otp', 'createdAt', unit, start),
        this.buckets(this.otpRepository, 'otp', 'consumedAt', unit, start),
        this.otpRepository
          .createQueryBuilder('otp')
          .select('otp.uuid', 'uuid')
          .addSelect('otp.destination', 'destination')
          .addSelect('otp.purpose', 'purpose')
          .addSelect('otp.createdAt', 'createdAt')
          .addSelect('otp.consumedAt', 'consumedAt')
          .addSelect('otp.expiresAt', 'expiresAt')
          .where('otp.createdAt >= :start', { start })
          .orderBy('otp.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            uuid: string;
            destination: string;
            purpose: string;
            createdAt: Date;
            consumedAt: Date | null;
            expiresAt: Date;
          }>(),
      ]);

    const rate = sent ? Math.round((consumed / sent) * 100) : 0;

    return this.pack({
      key: 'logins',
      range,
      unit,
      chart: {
        title: 'تلاش‌های ورود و تأیید',
        hint: 'نارنجی: کد ارسال‌شده · سرمه‌ای: کد تأییدشده',
        primaryLabel: 'ارسال کد',
        secondaryLabel: 'تأیید شده',
        points: zipSeries(start, now, unit, sentSeries, consumedSeries),
      },
      stats: [
        stat('کد ارسال‌شده', sent),
        stat('تأیید شده', consumed),
        stat('منقضی و استفاده‌نشده', expired),
        stat('هنوز معتبر', pending),
        stat('نرخ تأیید', rate, 'percent'),
        stat(
          'مقصد یکتا',
          await this.distinctDestinations(start),
        ),
      ],
      breakdownTitle: 'نوع درخواست در این بازه',
      breakdown: slices(byPurpose, OTP_PURPOSE_FA, true),
      listTitle: 'آخرین کدها',
      listHref: '/users',
      listLink: 'کاربران',
      empty: 'در این بازه کد تأییدی ارسال نشده.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title: OTP_PURPOSE_FA[row.purpose] || row.purpose,
        subtitle: maskDestination(row.destination),
        meta: otpMeta(row, now),
      })),
    });
  }

  private async products(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [
      total,
      active,
      created,
      unavailable,
      outOfStock,
      lowStock,
      byStatus,
      createdSeries,
      activeSeries,
      sellers,
      scarce,
    ] = await Promise.all([
      this.productRepository.count(),
      this.productRepository.count({ where: { status: ProductStatus.ACTIVE } }),
      this.productRepository
        .createQueryBuilder('p')
        .where('p.createdAt >= :start', { start })
        .getCount(),
      this.productRepository.count({ where: { isUnavailable: true } }),
      this.inventoryRepository
        .createQueryBuilder('i')
        .where('(i.quantity - i.reservedQuantity) <= 0')
        .getCount(),
      this.inventoryRepository
        .createQueryBuilder('i')
        .where('(i.quantity - i.reservedQuantity) > 0')
        .andWhere('(i.quantity - i.reservedQuantity) <= 5')
        .getCount(),
      this.grouped(this.productRepository, 'p', 'status', start),
      this.buckets(this.productRepository, 'p', 'createdAt', unit, start),
      this.buckets(
        this.productRepository,
        'p',
        'createdAt',
        unit,
        start,
        'p.status = :active',
        { active: ProductStatus.ACTIVE },
      ),
      this.topSellers(start),
      this.scarceStock(),
    ]);

    const rows = sellers.length
      ? sellers.map((row, index) => ({
          id: `${row.name}-${index}`,
          title: row.name,
          subtitle: `${Number(row.qty) || 0} عدد فروخته‌شده`,
          meta: `${Math.round(Number(row.amount) || 0)} ریال`,
        }))
      : scarce.map((row, index) => ({
          id: `${row.uuid}-${index}`,
          title: row.name,
          subtitle: 'موجودی کم یا تمام',
          meta: `${Number(row.available) || 0} عدد`,
        }));

    return this.pack({
      key: 'products',
      range,
      unit,
      chart: {
        title: 'محصولات ثبت‌شده',
        hint: 'نارنجی: همه ثبت‌ها · سرمه‌ای: همان‌ها که الان فعال‌اند',
        primaryLabel: 'ثبت محصول',
        secondaryLabel: 'فعال',
        points: zipSeries(start, now, unit, createdSeries, activeSeries),
      },
      stats: [
        stat('کل محصولات', total),
        stat('فعال', active),
        stat('ثبت در بازه', created),
        stat('توقف فروش', unavailable),
        stat('تنوع ناموجود', outOfStock),
        stat('تنوع کم‌موجود', lowStock),
      ],
      breakdownTitle: 'وضعیت محصولاتی که در این بازه ساخته شده‌اند',
      breakdown: slices(byStatus, PRODUCT_STATUS_FA, true),
      listTitle: sellers.length ? 'پرفروش‌های بازه' : 'کم‌موجودترین تنوع‌ها',
      listHref: sellers.length ? '/orders' : '/inventory',
      listLink: sellers.length ? 'سفارش‌ها' : 'انبار',
      empty: 'در این بازه محصولی ثبت نشده و کسری موجودی هم نیست.',
      rows,
    });
  }

  private async orders(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const paidWhere = 'o.createdAt >= :start AND o.paymentStatus = :paid';
    const paidParams = { start, paid: PaymentStatus.PAID };
    const [created, paid, pendingPay, cancelled, revenue, byStatus, allSeries, paidSeries, recent] =
      await Promise.all([
        this.orderRepository
          .createQueryBuilder('o')
          .where('o.createdAt >= :start', { start })
          .getCount(),
        this.orderRepository
          .createQueryBuilder('o')
          .where(paidWhere, paidParams)
          .getCount(),
        this.orderRepository
          .createQueryBuilder('o')
          .where('o.createdAt >= :start', { start })
          .andWhere('o.paymentStatus = :pending', { pending: PaymentStatus.PENDING })
          .getCount(),
        this.orderRepository
          .createQueryBuilder('o')
          .where('o.createdAt >= :start', { start })
          .andWhere('o.status = :cancelled', { cancelled: OrderStatus.CANCELLED })
          .getCount(),
        this.sumOf(this.orderRepository, 'o', 'total', paidWhere, paidParams),
        this.grouped(this.orderRepository, 'o', 'status', start),
        this.buckets(this.orderRepository, 'o', 'createdAt', unit, start),
        this.buckets(
          this.orderRepository,
          'o',
          'createdAt',
          unit,
          start,
          'o.paymentStatus = :paid',
          { paid: PaymentStatus.PAID },
        ),
        this.orderRepository
          .createQueryBuilder('o')
          .leftJoin('o.user', 'u')
          .select('o.uuid', 'uuid')
          .addSelect('o.orderNumber', 'orderNumber')
          .addSelect('o.status', 'status')
          .addSelect('o.paymentStatus', 'paymentStatus')
          .addSelect('o.total', 'total')
          .addSelect('o.createdAt', 'createdAt')
          .addSelect('u.firstName', 'firstName')
          .addSelect('u.lastName', 'lastName')
          .where('o.createdAt >= :start', { start })
          .orderBy('o.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            uuid: string;
            orderNumber: string;
            status: string;
            paymentStatus: string;
            total: string;
            createdAt: Date;
            firstName: string | null;
            lastName: string | null;
          }>(),
      ]);

    const avg = paid ? Math.round(revenue / paid) : 0;

    return this.pack({
      key: 'orders',
      range,
      unit,
      chart: {
        title: 'سفارش‌ها',
        hint: 'نارنجی: همه سفارش‌ها · سرمه‌ای: پرداخت‌شده',
        primaryLabel: 'سفارش',
        secondaryLabel: 'پرداخت‌شده',
        points: zipSeries(start, now, unit, allSeries, paidSeries),
      },
      stats: [
        stat('سفارش در بازه', created),
        stat('پرداخت‌شده', paid),
        stat('منتظر پرداخت', pendingPay),
        stat('لغو شده', cancelled),
        stat('مبلغ پرداخت‌شده', revenue, 'money'),
        stat('میانگین سبد پرداخت‌شده', avg, 'money'),
      ],
      breakdownTitle: 'وضعیت سفارش در این بازه',
      breakdown: slices(byStatus, ORDER_STATUS_FA, true),
      listTitle: 'آخرین سفارش‌ها',
      listHref: '/orders',
      listLink: 'سفارش‌ها',
      empty: 'در این بازه سفارشی ثبت نشده.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title: row.orderNumber,
        subtitle:
          [row.firstName, row.lastName].filter(Boolean).join(' ') || 'بدون نام',
        meta: `${ORDER_STATUS_FA[row.status] || row.status} · ${PAYMENT_STATUS_FA[row.paymentStatus] || row.paymentStatus} · ${agoLabel(new Date(row.createdAt), now).label}`,
      })),
    });
  }

  private async tickets(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [created, openNow, pendingNow, answeredNow, closedInRange, urgent, byCategory, createdSeries, closedSeries, recent] =
      await Promise.all([
        this.ticketRepository
          .createQueryBuilder('t')
          .where('t.createdAt >= :start', { start })
          .getCount(),
        this.ticketRepository.count({ where: { status: TicketStatus.OPEN } }),
        this.ticketRepository.count({ where: { status: TicketStatus.PENDING } }),
        this.ticketRepository.count({ where: { status: TicketStatus.ANSWERED } }),
        this.ticketRepository
          .createQueryBuilder('t')
          .where('t.closedAt >= :start', { start })
          .getCount(),
        this.ticketRepository
          .createQueryBuilder('t')
          .where('t.createdAt >= :start', { start })
          .andWhere('t.priority IN (:...high)', {
            high: [TicketPriority.HIGH, TicketPriority.URGENT],
          })
          .getCount(),
        this.grouped(this.ticketRepository, 't', 'category', start),
        this.buckets(this.ticketRepository, 't', 'createdAt', unit, start),
        this.buckets(this.ticketRepository, 't', 'closedAt', unit, start),
        this.ticketRepository
          .createQueryBuilder('t')
          .leftJoin('t.user', 'u')
          .select('t.uuid', 'uuid')
          .addSelect('t.subject', 'subject')
          .addSelect('t.status', 'status')
          .addSelect('t.priority', 'priority')
          .addSelect('t.createdAt', 'createdAt')
          .addSelect('u.firstName', 'firstName')
          .addSelect('u.lastName', 'lastName')
          .where('t.createdAt >= :start', { start })
          .orderBy('t.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            uuid: string;
            subject: string;
            status: string;
            priority: string;
            createdAt: Date;
            firstName: string | null;
            lastName: string | null;
          }>(),
      ]);

    return this.pack({
      key: 'tickets',
      range,
      unit,
      chart: {
        title: 'تیکت‌ها',
        hint: 'نارنجی: تیکت جدید · سرمه‌ای: بسته‌شده',
        primaryLabel: 'جدید',
        secondaryLabel: 'بسته',
        points: zipSeries(start, now, unit, createdSeries, closedSeries),
      },
      stats: [
        stat('تیکت در بازه', created),
        stat('باز الان', openNow),
        stat('در انتظار الان', pendingNow),
        stat('پاسخ‌داده‌شده الان', answeredNow),
        stat('بسته در بازه', closedInRange),
        stat('اولویت بالا یا فوری', urgent),
      ],
      breakdownTitle: 'موضوع تیکت‌های این بازه',
      breakdown: slices(byCategory, TICKET_CATEGORY_FA, false),
      listTitle: 'آخرین تیکت‌ها',
      listHref: '/tickets',
      listLink: 'تیکت‌ها',
      empty: 'در این بازه تیکتی ثبت نشده.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title: row.subject,
        subtitle:
          [row.firstName, row.lastName].filter(Boolean).join(' ') || 'مشتری',
        meta: `${TICKET_STATUS_FA[row.status] || row.status} · ${TICKET_PRIORITY_FA[row.priority] || row.priority} · ${agoLabel(new Date(row.createdAt), now).label}`,
      })),
    });
  }

  private async magazine(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [total, published, draft, featured, publishedInRange, created, byStatus, createdSeries, publishedSeries, recent] =
      await Promise.all([
        this.postRepository.count(),
        this.postRepository.count({ where: { status: PostStatus.PUBLISHED } }),
        this.postRepository.count({ where: { status: PostStatus.DRAFT } }),
        this.postRepository.count({ where: { isFeatured: true } }),
        this.postRepository
          .createQueryBuilder('p')
          .where('p.publishedAt >= :start', { start })
          .andWhere('p.status = :published', { published: PostStatus.PUBLISHED })
          .getCount(),
        this.postRepository
          .createQueryBuilder('p')
          .where('p.createdAt >= :start', { start })
          .getCount(),
        this.grouped(this.postRepository, 'p', 'status', start),
        this.buckets(this.postRepository, 'p', 'createdAt', unit, start),
        this.buckets(
          this.postRepository,
          'p',
          'publishedAt',
          unit,
          start,
          'p.status = :published',
          { published: PostStatus.PUBLISHED },
        ),
        this.postRepository
          .createQueryBuilder('p')
          .select('p.uuid', 'uuid')
          .addSelect('p.title', 'title')
          .addSelect('p.status', 'status')
          .addSelect('p.readingTimeMinutes', 'reading')
          .addSelect('p.createdAt', 'createdAt')
          .where('p.createdAt >= :start', { start })
          .orderBy('p.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            uuid: string;
            title: string;
            status: string;
            reading: number;
            createdAt: Date;
          }>(),
      ]);

    return this.pack({
      key: 'mag',
      range,
      unit,
      chart: {
        title: 'مجله',
        hint: 'نارنجی: مطلب ساخته‌شده · سرمه‌ای: منتشرشده',
        primaryLabel: 'ساخته‌شده',
        secondaryLabel: 'منتشرشده',
        points: zipSeries(start, now, unit, createdSeries, publishedSeries),
      },
      stats: [
        stat('کل مطالب', total),
        stat('منتشرشده', published),
        stat('پیش‌نویس', draft),
        stat('ویژه', featured),
        stat('ساخته‌شده در بازه', created),
        stat('انتشار در بازه', publishedInRange),
      ],
      breakdownTitle: 'وضعیت مطالب ساخته‌شده در این بازه',
      breakdown: slices(byStatus, POST_STATUS_FA, true),
      listTitle: 'آخرین مطالب',
      listHref: '/cms/blog',
      listLink: 'مجله',
      empty: 'در این بازه مطلبی ساخته نشده.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title: row.title,
        subtitle: `${Number(row.reading) || 1} دقیقه مطالعه`,
        meta: `${POST_STATUS_FA[row.status] || row.status} · ${agoLabel(new Date(row.createdAt), now).label}`,
      })),
    });
  }

  private async comments(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const unanswered = `(r.adminReply IS NULL OR BTRIM(r.adminReply) = '')`;
    const [reviews, reviewPending, reviewApproved, reviewUnanswered, blogComments, blogPending, avgRow, byRating, reviewSeries, blogSeries, recent] =
      await Promise.all([
        this.reviewRepository
          .createQueryBuilder('r')
          .where('r.createdAt >= :start', { start })
          .getCount(),
        this.reviewRepository
          .createQueryBuilder('r')
          .where('r.createdAt >= :start', { start })
          .andWhere('r.isApproved = false')
          .getCount(),
        this.reviewRepository
          .createQueryBuilder('r')
          .where('r.createdAt >= :start', { start })
          .andWhere('r.isApproved = true')
          .getCount(),
        this.reviewRepository
          .createQueryBuilder('r')
          .where('r.createdAt >= :start', { start })
          .andWhere(unanswered)
          .getCount(),
        this.commentRepository
          .createQueryBuilder('c')
          .where('c.createdAt >= :start', { start })
          .getCount(),
        this.commentRepository
          .createQueryBuilder('c')
          .where('c.createdAt >= :start', { start })
          .andWhere('c.isApproved = false')
          .getCount(),
        this.reviewRepository
          .createQueryBuilder('r')
          .select('AVG(r.rating)', 'avg')
          .where('r.createdAt >= :start', { start })
          .getRawOne<{ avg: string | null }>(),
        this.grouped(this.reviewRepository, 'r', 'rating', start),
        this.buckets(this.reviewRepository, 'r', 'createdAt', unit, start),
        this.buckets(this.commentRepository, 'c', 'createdAt', unit, start),
        this.reviewRepository
          .createQueryBuilder('r')
          .innerJoin('r.product', 'p')
          .leftJoin('r.user', 'u')
          .select('r.uuid', 'uuid')
          .addSelect('r.rating', 'rating')
          .addSelect('r.title', 'title')
          .addSelect('r.body', 'body')
          .addSelect('r.isApproved', 'isApproved')
          .addSelect('r.createdAt', 'createdAt')
          .addSelect('p.name', 'productName')
          .addSelect('u.firstName', 'firstName')
          .addSelect('u.lastName', 'lastName')
          .where('r.createdAt >= :start', { start })
          .orderBy('r.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            uuid: string;
            rating: number;
            title: string | null;
            body: string | null;
            isApproved: boolean;
            createdAt: Date;
            productName: string;
            firstName: string | null;
            lastName: string | null;
          }>(),
      ]);

    const avg = avgRow?.avg ? Math.round(Number(avgRow.avg) * 10) / 10 : 0;
    const ratingLabels: Record<string, string> = {
      '5': '۵ ستاره',
      '4': '۴ ستاره',
      '3': '۳ ستاره',
      '2': '۲ ستاره',
      '1': '۱ ستاره',
    };

    return this.pack({
      key: 'comments',
      range,
      unit,
      chart: {
        title: 'کامنت‌ها',
        hint: `نارنجی: دیدگاه محصول · سرمه‌ای: کامنت مجله · میانگین امتیاز ${avg || 0}`,
        primaryLabel: 'دیدگاه محصول',
        secondaryLabel: 'کامنت مجله',
        points: zipSeries(start, now, unit, reviewSeries, blogSeries),
      },
      stats: [
        stat('دیدگاه محصول', reviews),
        stat('منتظر تأیید', reviewPending),
        stat('تأیید شده', reviewApproved),
        stat('بدون پاسخ فروشگاه', reviewUnanswered),
        stat('کامنت مجله', blogComments),
        stat('مجله منتظر تأیید', blogPending),
      ],
      breakdownTitle: 'امتیاز دیدگاه‌های این بازه',
      breakdown: slices(byRating, ratingLabels, true),
      listTitle: 'آخرین دیدگاه‌ها',
      listHref: '/reviews',
      listLink: 'کامنت‌ها',
      empty: 'در این بازه دیدگاهی ثبت نشده.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title: row.productName,
        subtitle: clip(row.title || row.body || 'بدون متن'),
        meta: `${row.rating} ستاره · ${row.isApproved ? 'تأیید' : 'منتظر'} · ${[row.firstName, row.lastName].filter(Boolean).join(' ') || 'مشتری'} · ${agoLabel(new Date(row.createdAt), now).label}`,
      })),
    });
  }

  private async chat(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [conversations, messages, fromCustomer, fromAdmin, withFile, unreadRow, byStatus, customerSeries, adminSeries, recent] =
      await Promise.all([
        this.chatRepository
          .createQueryBuilder('c')
          .where('c.createdAt >= :start', { start })
          .getCount(),
        this.messageRepository
          .createQueryBuilder('m')
          .where('m.createdAt >= :start', { start })
          .getCount(),
        this.messageRepository
          .createQueryBuilder('m')
          .where('m.createdAt >= :start', { start })
          .andWhere('m.senderRole = :role', { role: ChatSenderRole.CUSTOMER })
          .getCount(),
        this.messageRepository
          .createQueryBuilder('m')
          .where('m.createdAt >= :start', { start })
          .andWhere('m.senderRole = :role', { role: ChatSenderRole.ADMIN })
          .getCount(),
        this.messageRepository
          .createQueryBuilder('m')
          .where('m.createdAt >= :start', { start })
          .andWhere('m.fileId IS NOT NULL')
          .getCount(),
        this.chatRepository
          .createQueryBuilder('c')
          .select('COALESCE(SUM(c.adminUnreadCount), 0)', 'total')
          .getRawOne<{ total: string }>(),
        this.chatRepository
          .createQueryBuilder('c')
          .select('c.status', 'key')
          .addSelect('COUNT(*)', 'count')
          .groupBy('c.status')
          .getRawMany<{ key: string; count: string }>(),
        this.buckets(
          this.messageRepository,
          'm',
          'createdAt',
          unit,
          start,
          'm.senderRole = :role',
          { role: ChatSenderRole.CUSTOMER },
        ),
        this.buckets(
          this.messageRepository,
          'm',
          'createdAt',
          unit,
          start,
          'm.senderRole = :role',
          { role: ChatSenderRole.ADMIN },
        ),
        this.chatRepository
          .createQueryBuilder('c')
          .leftJoin('c.customer', 'u')
          .select('c.uuid', 'uuid')
          .addSelect('c.subject', 'subject')
          .addSelect('c.lastMessagePreview', 'preview')
          .addSelect('c.adminUnreadCount', 'unread')
          .addSelect('c.status', 'status')
          .addSelect('c.lastMessageAt', 'lastMessageAt')
          .addSelect('u.firstName', 'firstName')
          .addSelect('u.lastName', 'lastName')
          .where('(c.lastMessageAt >= :start OR c.createdAt >= :start)', { start })
          .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
          .limit(8)
          .getRawMany<{
            uuid: string;
            subject: string | null;
            preview: string | null;
            unread: number;
            status: string;
            lastMessageAt: Date | null;
            firstName: string | null;
            lastName: string | null;
          }>(),
      ]);

    return this.pack({
      key: 'chat',
      range,
      unit,
      chart: {
        title: 'گفتگوی پشتیبانی',
        hint: 'نارنجی: پیام مشتری · سرمه‌ای: پیام پشتیبان',
        primaryLabel: 'مشتری',
        secondaryLabel: 'پشتیبان',
        points: zipSeries(start, now, unit, customerSeries, adminSeries),
      },
      stats: [
        stat('گفتگوی جدید', conversations),
        stat('پیام در بازه', messages),
        stat('پیام مشتری', fromCustomer),
        stat('پیام پشتیبان', fromAdmin),
        stat('پیام تصویری', withFile),
        stat('نخوانده برای پشتیبان', Number(unreadRow?.total ?? 0)),
      ],
      breakdownTitle: 'وضعیت فعلی گفتگوها',
      breakdown: slices(byStatus, CHAT_STATUS_FA, true),
      listTitle: 'آخرین گفتگوها',
      listHref: '/chat',
      listLink: 'چت',
      empty: 'در این بازه گفتگویی نیست.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title:
          [row.firstName, row.lastName].filter(Boolean).join(' ') ||
          row.subject ||
          'گفتگو',
        subtitle: clip(row.preview || row.subject || 'بدون متن'),
        meta: `${CHAT_STATUS_FA[row.status] || row.status} · ${Number(row.unread) || 0} نخوانده · ${agoLabel(new Date(row.lastMessageAt || now), now).label}`,
      })),
    });
  }

  private async payments(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [created, paid, failed, pending, refunded, revenue, receipts, byMethod, allSeries, paidSeries, recent] =
      await Promise.all([
        this.paymentRepository
          .createQueryBuilder('p')
          .where('p.createdAt >= :start', { start })
          .getCount(),
        this.paymentRepository
          .createQueryBuilder('p')
          .where('p.createdAt >= :start', { start })
          .andWhere('p.status = :paid', { paid: PaymentStatus.PAID })
          .getCount(),
        this.paymentRepository
          .createQueryBuilder('p')
          .where('p.createdAt >= :start', { start })
          .andWhere('p.status = :failed', { failed: PaymentStatus.FAILED })
          .getCount(),
        this.paymentRepository
          .createQueryBuilder('p')
          .where('p.createdAt >= :start', { start })
          .andWhere('p.status = :pending', { pending: PaymentStatus.PENDING })
          .getCount(),
        this.paymentRepository
          .createQueryBuilder('p')
          .where('p.createdAt >= :start', { start })
          .andWhere('p.status IN (:...back)', {
            back: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
          })
          .getCount(),
        this.sumOf(
          this.paymentRepository,
          'p',
          'amount',
          'p.createdAt >= :start AND p.status = :paid',
          { start, paid: PaymentStatus.PAID },
        ),
        this.paymentRepository
          .createQueryBuilder('p')
          .where('p.method = :method', { method: PaymentMethod.BANK_TRANSFER })
          .andWhere('p.status = :pending', { pending: PaymentStatus.PENDING })
          .andWhere(`p.metadata->>'awaitingAdminReview' = 'true'`)
          .getCount(),
        this.grouped(this.paymentRepository, 'p', 'method', start),
        this.buckets(this.paymentRepository, 'p', 'createdAt', unit, start),
        this.buckets(
          this.paymentRepository,
          'p',
          'createdAt',
          unit,
          start,
          'p.status = :paid',
          { paid: PaymentStatus.PAID },
        ),
        this.paymentRepository
          .createQueryBuilder('p')
          .innerJoin('p.order', 'o')
          .select('p.uuid', 'uuid')
          .addSelect('p.amount', 'amount')
          .addSelect('p.method', 'method')
          .addSelect('p.status', 'status')
          .addSelect('p.createdAt', 'createdAt')
          .addSelect('o.orderNumber', 'orderNumber')
          .where('p.createdAt >= :start', { start })
          .orderBy('p.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            uuid: string;
            amount: string;
            method: string;
            status: string;
            createdAt: Date;
            orderNumber: string;
          }>(),
      ]);

    return this.pack({
      key: 'payments',
      range,
      unit,
      chart: {
        title: 'پرداخت‌ها',
        hint: 'نارنجی: همه تراکنش‌ها · سرمه‌ای: موفق',
        primaryLabel: 'تراکنش',
        secondaryLabel: 'موفق',
        points: zipSeries(start, now, unit, allSeries, paidSeries),
      },
      stats: [
        stat('تراکنش در بازه', created),
        stat('موفق', paid),
        stat('ناموفق', failed),
        stat('در انتظار', pending),
        stat('مبلغ موفق', revenue, 'money'),
        stat('فیش منتظر بررسی', receipts),
      ],
      breakdownTitle: 'روش پرداخت در این بازه',
      breakdown: [
        ...slices(byMethod, PAYMENT_METHOD_FA, false),
        { label: 'بازگشت وجه', value: refunded },
      ].filter((item) => item.value > 0),
      listTitle: 'آخرین تراکنش‌ها',
      listHref: '/orders',
      listLink: 'سفارش‌ها',
      empty: 'در این بازه تراکنشی نیست.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title: row.orderNumber,
        subtitle: PAYMENT_METHOD_FA[row.method] || row.method,
        meta: `${PAYMENT_STATUS_FA[row.status] || row.status} · ${Math.round(Number(row.amount) || 0)} ریال · ${agoLabel(new Date(row.createdAt), now).label}`,
      })),
    });
  }

  private async inventory(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [moves, outQty, inQty, reservedQty, outOfStock, lowStock, byType, outSeries, inSeries, recent] =
      await Promise.all([
        this.movementRepository
          .createQueryBuilder('m')
          .where('m.createdAt >= :start', { start })
          .getCount(),
        this.movementQty(start, StockMovementType.OUT),
        this.movementQty(start, StockMovementType.IN),
        this.movementQty(start, StockMovementType.ADJUSTMENT, 'order_reserve'),
        this.inventoryRepository
          .createQueryBuilder('i')
          .where('(i.quantity - i.reservedQuantity) <= 0')
          .getCount(),
        this.inventoryRepository
          .createQueryBuilder('i')
          .where('(i.quantity - i.reservedQuantity) > 0')
          .andWhere('(i.quantity - i.reservedQuantity) <= 5')
          .getCount(),
        this.grouped(this.movementRepository, 'm', 'type', start),
        this.buckets(
          this.movementRepository,
          'm',
          'createdAt',
          unit,
          start,
          'm.type = :type',
          { type: StockMovementType.OUT },
        ),
        this.buckets(
          this.movementRepository,
          'm',
          'createdAt',
          unit,
          start,
          'm.type = :type',
          { type: StockMovementType.IN },
        ),
        this.movementRepository
          .createQueryBuilder('m')
          .innerJoin('m.variant', 'v')
          .innerJoin('v.product', 'p')
          .select('m.uuid', 'uuid')
          .addSelect('m.type', 'type')
          .addSelect('m.quantity', 'quantity')
          .addSelect('m.referenceType', 'referenceType')
          .addSelect('m.createdAt', 'createdAt')
          .addSelect('p.name', 'name')
          .addSelect('v.sku', 'sku')
          .where('m.createdAt >= :start', { start })
          .orderBy('m.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            uuid: string;
            type: string;
            quantity: number;
            referenceType: string | null;
            createdAt: Date;
            name: string;
            sku: string;
          }>(),
      ]);

    return this.pack({
      key: 'inventory',
      range,
      unit,
      chart: {
        title: 'حرکت انبار',
        hint: 'نارنجی: خروج · سرمه‌ای: ورود. عددها تعداد سند است، نه عدد کالا.',
        primaryLabel: 'خروج',
        secondaryLabel: 'ورود',
        points: zipSeries(start, now, unit, outSeries, inSeries),
      },
      stats: [
        stat('سند در بازه', moves),
        stat('عدد خروج', outQty),
        stat('عدد ورود', inQty),
        stat('رزرو سفارش', reservedQty),
        stat('تنوع ناموجود الان', outOfStock),
        stat('تنوع کم‌موجود الان', lowStock),
      ],
      breakdownTitle: 'نوع سند در این بازه',
      breakdown: slices(byType, MOVEMENT_FA, true),
      listTitle: 'آخرین حرکت‌ها',
      listHref: '/inventory',
      listLink: 'انبار',
      empty: 'در این بازه حرکت انباری ثبت نشده.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title: row.name,
        subtitle: row.sku || MOVEMENT_REF_FA[row.referenceType || ''] || 'دستی',
        meta: `${MOVEMENT_FA[row.type] || row.type} · ${Number(row.quantity) || 0} عدد · ${agoLabel(new Date(row.createdAt), now).label}`,
      })),
    });
  }

  private async carts(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [openNow, touched, guest, member, lines, stuckValue, orders, itemSeries, orderSeries, top] =
      await Promise.all([
        this.distinctCarts(),
        this.distinctCarts(start),
        this.distinctCarts(start, 'guest'),
        this.distinctCarts(start, 'member'),
        this.cartItemRepository
          .createQueryBuilder('ci')
          .innerJoin('ci.cart', 'c')
          .where('c.updatedAt >= :start', { start })
          .getCount(),
        this.stuckCartValue(start),
        this.orderRepository
          .createQueryBuilder('o')
          .where('o.createdAt >= :start', { start })
          .getCount(),
        this.buckets(this.cartItemRepository, 'ci', 'createdAt', unit, start),
        this.buckets(this.orderRepository, 'o', 'createdAt', unit, start),
        this.stuckProducts(start),
      ]);
    const share = touched + orders ? Math.round((touched / (touched + orders)) * 100) : 0;

    return this.pack({
      key: 'carts',
      range,
      unit,
      chart: {
        title: 'سبد در برابر سفارش',
        hint: 'نارنجی: قلمی که به سبد اضافه شده · سرمه‌ای: سفارش ثبت‌شده. سبد بعد از ثبت سفارش خالی می‌شود.',
        primaryLabel: 'قلم سبد',
        secondaryLabel: 'سفارش',
        points: zipSeries(start, now, unit, itemSeries, orderSeries),
      },
      stats: [
        stat('سبد باز الان', openNow),
        stat('دست‌خورده در بازه', touched),
        stat('قلم داخل همان سبدها', lines),
        stat('مبلغ گیرکرده', stuckValue, 'money'),
        stat('سفارش در بازه', orders),
        stat('سهم سبد باز', share, 'percent'),
      ],
      breakdownTitle: 'صاحب سبدهای این بازه',
      breakdown: [
        { label: 'مهمان', value: guest },
        { label: 'مشتری', value: member },
      ],
      listTitle: 'کالاهای گیرکرده در سبد',
      listHref: '/carts',
      listLink: 'سبدها',
      empty: 'در این بازه سبد بازی با کالا نیست.',
      rows: top.map((row, index) => ({
        id: `${row.name}-${index}`,
        title: row.name,
        subtitle: `${Number(row.qty) || 0} عدد در سبدهای باز`,
        meta: `${Math.round(Number(row.amount) || 0)} ریال`,
      })),
    });
  }

  private async wishlist(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [saved, products, people, converted, unavailable, addSeries, hitSeries, top] =
      await Promise.all([
        this.wishlistItemRepository
          .createQueryBuilder('wi')
          .where('wi.createdAt >= :start', { start })
          .getCount(),
        this.distinctWish('product', start),
        this.distinctWish('user', start),
        this.wishlistConverted(start),
        this.wishlistUnavailable(start),
        this.buckets(this.wishlistItemRepository, 'wi', 'createdAt', unit, start),
        this.wishlistHitSeries(start, unit),
        this.wishlistItemRepository
          .createQueryBuilder('wi')
          .innerJoin('wi.product', 'p')
          .select('p.name', 'name')
          .addSelect('COUNT(*)', 'count')
          .where('wi.createdAt >= :start', { start })
          .groupBy('p.name')
          .orderBy('COUNT(*)', 'DESC')
          .limit(8)
          .getRawMany<{ name: string; count: string }>(),
      ]);
    const rate = saved ? Math.round((converted / saved) * 100) : 0;

    return this.pack({
      key: 'wishlist',
      range,
      unit,
      chart: {
        title: 'علاقه‌مندی',
        hint: 'نارنجی: ذخیره جدید · سرمه‌ای: همان ذخیره که بعداً سفارش شده',
        primaryLabel: 'ذخیره',
        secondaryLabel: 'تبدیل به سفارش',
        points: zipSeries(start, now, unit, addSeries, hitSeries),
      },
      stats: [
        stat('ذخیره در بازه', saved),
        stat('کالای یکتا', products),
        stat('مشتری یکتا', people),
        stat('تبدیل به سفارش', converted),
        stat('نرخ تبدیل', rate, 'percent'),
        stat('روی کالای ناموجود', unavailable),
      ],
      breakdownTitle: 'پرتکرارترین ذخیره‌ها',
      breakdown: top.map((row) => ({
        label: row.name,
        value: Number(row.count) || 0,
      })),
      listTitle: 'آخرین علاقه‌مندی‌ها',
      listHref: '/wishlist',
      listLink: 'علاقه‌مندی',
      empty: 'در این بازه علاقه‌مندی ثبت نشده.',
      rows: (
        await this.wishlistItemRepository
          .createQueryBuilder('wi')
          .innerJoin('wi.product', 'p')
          .innerJoin('wi.wishlist', 'w')
          .innerJoin('w.user', 'u')
          .select('wi.id', 'id')
          .addSelect('p.name', 'name')
          .addSelect('wi.createdAt', 'createdAt')
          .addSelect('u.firstName', 'firstName')
          .addSelect('u.lastName', 'lastName')
          .where('wi.createdAt >= :start', { start })
          .orderBy('wi.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            id: number;
            name: string;
            createdAt: Date;
            firstName: string | null;
            lastName: string | null;
          }>()
      ).map((row) => ({
        id: String(row.id),
        title: row.name,
        subtitle: [row.firstName, row.lastName].filter(Boolean).join(' ') || 'مشتری',
        meta: agoLabel(new Date(row.createdAt), now).label,
      })),
    });
  }

  private async shipping(
    range: DashboardRange,
    window: { start: Date; unit: BucketUnit },
    now: Date,
  ): Promise<SectionPayload> {
    const { start, unit } = window;
    const [orders, shipped, delivered, missing, hours, problems, byMethod, orderSeries, shippedSeries, recent] =
      await Promise.all([
        this.orderRepository
          .createQueryBuilder('o')
          .where('o.createdAt >= :start', { start })
          .getCount(),
        this.shipmentRepository
          .createQueryBuilder('s')
          .where('s.shippedAt >= :start', { start })
          .getCount(),
        this.shipmentRepository
          .createQueryBuilder('s')
          .where('s.deliveredAt >= :start', { start })
          .getCount(),
        this.missingTracking(start),
        this.avgShipHours(start),
        this.shipmentRepository
          .createQueryBuilder('s')
          .where('s.createdAt >= :start', { start })
          .andWhere('s.status IN (:...bad)', {
            bad: ['returned', 'failed'],
          })
          .getCount(),
        this.grouped(this.orderRepository, 'o', 'shippingMethodCode', start),
        this.buckets(this.orderRepository, 'o', 'createdAt', unit, start),
        this.buckets(this.shipmentRepository, 's', 'shippedAt', unit, start),
        this.shipmentRepository
          .createQueryBuilder('s')
          .innerJoin('s.order', 'o')
          .select('s.uuid', 'uuid')
          .addSelect('s.status', 'status')
          .addSelect('s.carrier', 'carrier')
          .addSelect('s.trackingNumber', 'trackingNumber')
          .addSelect('s.createdAt', 'createdAt')
          .addSelect('o.orderNumber', 'orderNumber')
          .addSelect('o.shippingMethodTitle', 'methodTitle')
          .where('s.createdAt >= :start', { start })
          .orderBy('s.createdAt', 'DESC')
          .limit(8)
          .getRawMany<{
            uuid: string;
            status: string;
            carrier: string | null;
            trackingNumber: string | null;
            createdAt: Date;
            orderNumber: string;
            methodTitle: string | null;
          }>(),
      ]);

    return this.pack({
      key: 'shipping',
      range,
      unit,
      chart: {
        title: 'ارسال',
        hint: 'نارنجی: سفارش ثبت‌شده · سرمه‌ای: مرسوله‌ای که ارسال شده',
        primaryLabel: 'سفارش',
        secondaryLabel: 'ارسال شده',
        points: zipSeries(start, now, unit, orderSeries, shippedSeries),
      },
      stats: [
        stat('سفارش در بازه', orders),
        stat('ارسال شده', shipped),
        stat('تحویل شده', delivered),
        stat('پرداخت‌شده بدون رهگیری', missing),
        stat('میانگین ساعت تا ارسال', hours, 'decimal'),
        stat('مرجوع یا ناموفق', problems),
      ],
      breakdownTitle: 'روش ارسال سفارش‌های این بازه',
      breakdown: byMethod
        .map((row) => ({
          label: SHIP_METHOD_FA[String(row.key)] || String(row.key),
          value: Number(row.count) || 0,
        }))
        .filter((item) => item.value > 0),
      listTitle: 'آخرین مرسوله‌ها',
      listHref: '/orders',
      listLink: 'سفارش‌ها',
      empty: 'در این بازه مرسوله‌ای ثبت نشده.',
      rows: recent.map((row) => ({
        id: row.uuid,
        title: row.orderNumber,
        subtitle: row.methodTitle || row.carrier || 'بدون روش',
        meta: `${SHIPMENT_STATUS_FA[row.status] || row.status} · ${row.trackingNumber?.trim() || 'بدون رهگیری'} · ${agoLabel(new Date(row.createdAt), now).label}`,
      })),
    });
  }

  private pack(payload: SectionPayload) {
    return payload;
  }

  private async movementQty(start: Date, type: StockMovementType, reference?: string) {
    const qb = this.movementRepository
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.quantity), 0)', 'total')
      .where('m.createdAt >= :start', { start })
      .andWhere('m.type = :type', { type });
    if (reference) qb.andWhere('m.referenceType = :reference', { reference });
    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async distinctCarts(start?: Date, who?: 'guest' | 'member') {
    const qb = this.cartRepository
      .createQueryBuilder('c')
      .innerJoin('c.items', 'ci')
      .select('COUNT(DISTINCT c.id)', 'count');
    if (start) qb.where('c.updatedAt >= :start', { start });
    if (who === 'guest') qb.andWhere('c.userId IS NULL');
    if (who === 'member') qb.andWhere('c.userId IS NOT NULL');
    const row = await qb.getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private async stuckCartValue(start: Date) {
    const rows = await this.cartItemRepository.query(
      `SELECT COALESCE(SUM(ci.quantity * eff.amount), 0) AS total
       FROM cart_items ci
       INNER JOIN carts c ON c.id = ci.cart_id AND c."deletedAt" IS NULL
       INNER JOIN LATERAL (
         SELECT pr.amount::numeric AS amount
         FROM prices pr
         WHERE pr.variant_id = ci.variant_id
           AND pr."isActive" = true
           AND pr."deletedAt" IS NULL
           AND COALESCE(pr."effectiveFrom", pr."createdAt") <= NOW()
         ORDER BY COALESCE(pr."effectiveFrom", pr."createdAt") DESC, pr."createdAt" DESC
         LIMIT 1
       ) eff ON true
       WHERE c."updatedAt" >= $1`,
      [start],
    );
    return Math.round(Number(rows[0]?.total ?? 0));
  }

  private stuckProducts(start: Date) {
    return this.cartItemRepository.query(
      `SELECT p.name AS name,
              SUM(ci.quantity) AS qty,
              SUM(ci.quantity * eff.amount) AS amount
       FROM cart_items ci
       INNER JOIN carts c ON c.id = ci.cart_id AND c."deletedAt" IS NULL
       INNER JOIN product_variants v ON v.id = ci.variant_id AND v."deletedAt" IS NULL
       INNER JOIN products p ON p.id = v.product_id AND p."deletedAt" IS NULL
       INNER JOIN LATERAL (
         SELECT pr.amount::numeric AS amount
         FROM prices pr
         WHERE pr.variant_id = ci.variant_id
           AND pr."isActive" = true
           AND pr."deletedAt" IS NULL
           AND COALESCE(pr."effectiveFrom", pr."createdAt") <= NOW()
         ORDER BY COALESCE(pr."effectiveFrom", pr."createdAt") DESC, pr."createdAt" DESC
         LIMIT 1
       ) eff ON true
       WHERE c."updatedAt" >= $1
       GROUP BY p.name
       ORDER BY SUM(ci.quantity) DESC
       LIMIT 8`,
      [start],
    ) as Promise<{ name: string; qty: string; amount: string }[]>;
  }

  private async distinctWish(kind: 'product' | 'user', start: Date) {
    const qb = this.wishlistItemRepository
      .createQueryBuilder('wi')
      .innerJoin('wi.wishlist', 'w')
      .where('wi.createdAt >= :start', { start });
    qb.select(
      kind === 'product' ? 'COUNT(DISTINCT wi.productId)' : 'COUNT(DISTINCT w.userId)',
      'count',
    );
    const row = await qb.getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private async wishlistConverted(start: Date) {
    const rows = await this.wishlistItemRepository.query(
      `SELECT COUNT(*) AS count
       FROM wishlist_items wi
       INNER JOIN wishlists w ON w.id = wi.wishlist_id AND w."deletedAt" IS NULL
       WHERE wi."createdAt" >= $1
         AND EXISTS (
           SELECT 1 FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id AND o."deletedAt" IS NULL
           WHERE o.user_id = w.user_id
             AND oi.product_id = wi.product_id
             AND o."createdAt" >= wi."createdAt"
             AND o.status <> 'cancelled'
         )`,
      [start],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async wishlistUnavailable(start: Date) {
    const rows = await this.wishlistItemRepository.query(
      `SELECT COUNT(*) AS count
       FROM wishlist_items wi
       INNER JOIN products p ON p.id = wi.product_id AND p."deletedAt" IS NULL
       WHERE wi."createdAt" >= $1
         AND (
           p."isUnavailable" = true
           OR NOT EXISTS (
             SELECT 1 FROM inventories i
             INNER JOIN product_variants v ON v.id = i.variant_id AND v."deletedAt" IS NULL
             WHERE v.product_id = p.id
               AND (i.quantity - i."reservedQuantity") > 0
               AND i."deletedAt" IS NULL
           )
         )`,
      [start],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private wishlistHitSeries(start: Date, unit: BucketUnit) {
    return this.wishlistItemRepository
      .createQueryBuilder('wi')
      .innerJoin('wi.wishlist', 'w')
      .select(`date_trunc('${unit}', wi.createdAt)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('wi.createdAt >= :start', { start })
      .andWhere(
        `EXISTS (
          SELECT 1 FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id AND o."deletedAt" IS NULL
          WHERE o.user_id = w.user_id
            AND oi.product_id = wi.product_id
            AND o."createdAt" >= wi."createdAt"
            AND o.status <> 'cancelled'
        )`,
      )
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: Date | string; count: string }>();
  }

  private async missingTracking(start: Date) {
    const rows = await this.orderRepository.query(
      `SELECT COUNT(DISTINCT o.id) AS count
       FROM orders o
       LEFT JOIN shipments s ON s.order_id = o.id AND s."deletedAt" IS NULL
       WHERE o."deletedAt" IS NULL
         AND o."createdAt" >= $1
         AND o."paymentStatus" = 'paid'
         AND o.status <> 'cancelled'
         AND (s.id IS NULL OR s."trackingNumber" IS NULL OR BTRIM(s."trackingNumber") = '')`,
      [start],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async avgShipHours(start: Date) {
    const rows = await this.shipmentRepository.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (s."shippedAt" - o."createdAt")) / 3600) AS hours
       FROM shipments s
       INNER JOIN orders o ON o.id = s.order_id AND o."deletedAt" IS NULL
       WHERE s."deletedAt" IS NULL
         AND s."shippedAt" IS NOT NULL
         AND s."shippedAt" >= $1`,
      [start],
    );
    const hours = Number(rows[0]?.hours ?? 0);
    return Number.isFinite(hours) ? Math.round(hours * 10) / 10 : 0;
  }

  private buckets(
    repo: Repository<object>,
    alias: string,
    column: string,
    unit: BucketUnit,
    start: Date,
    extra?: string,
    params?: Record<string, unknown>,
  ) {
    const qb = repo
      .createQueryBuilder(alias)
      .select(`date_trunc('${unit}', ${alias}.${column})`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where(`${alias}.${column} >= :start`, { start });
    if (extra) qb.andWhere(extra, params);
    return qb
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<BucketRow>();
  }

  private grouped(
    repo: Repository<object>,
    alias: string,
    column: string,
    start: Date,
  ) {
    return repo
      .createQueryBuilder(alias)
      .select(`${alias}.${column}`, 'key')
      .addSelect('COUNT(*)', 'count')
      .where(`${alias}.${column} IS NOT NULL`)
      .andWhere(`${alias}.createdAt >= :start`, { start })
      .groupBy(`${alias}.${column}`)
      .getRawMany<{ key: string; count: string }>();
  }

  private async sumOf(
    repo: Repository<object>,
    alias: string,
    column: string,
    where: string,
    params: Record<string, unknown>,
  ) {
    const row = await repo
      .createQueryBuilder(alias)
      .select(`COALESCE(SUM(${alias}.${column}), 0)`, 'total')
      .where(where, params)
      .getRawOne<{ total: string }>();
    return Math.round(Number(row?.total ?? 0));
  }

  private async distinctDestinations(start: Date) {
    const row = await this.otpRepository
      .createQueryBuilder('otp')
      .select('COUNT(DISTINCT otp.destination)', 'count')
      .where('otp.createdAt >= :start', { start })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private topSellers(start: Date) {
    return this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .select('oi.productName', 'name')
      .addSelect('SUM(oi.quantity)', 'qty')
      .addSelect('SUM(oi.totalPrice)', 'amount')
      .where('o.createdAt >= :start', { start })
      .andWhere('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .groupBy('oi.productName')
      .orderBy('SUM(oi.quantity)', 'DESC')
      .limit(8)
      .getRawMany<{ name: string; qty: string; amount: string }>();
  }

  private scarceStock() {
    return this.inventoryRepository
      .createQueryBuilder('i')
      .innerJoin('i.variant', 'v')
      .innerJoin('v.product', 'p')
      .select('p.uuid', 'uuid')
      .addSelect('p.name', 'name')
      .addSelect('(i.quantity - i.reservedQuantity)', 'available')
      .where('(i.quantity - i.reservedQuantity) <= 5')
      .orderBy('(i.quantity - i.reservedQuantity)', 'ASC')
      .limit(8)
      .getRawMany<{ uuid: string; name: string; available: string }>();
  }
}

function stat(label: string, value: number, kind: StatKind = 'count'): SectionStat {
  return { label, value, kind };
}

function slices(
  rows: { key: string; count: string }[],
  labels: Record<string, string>,
  keepEmpty: boolean,
): SectionSlice[] {
  const map = new Map(rows.map((row) => [String(row.key), Number(row.count) || 0]));
  const items = Object.entries(labels).map(([key, label]) => ({
    label,
    value: map.get(key) ?? 0,
  }));
  return keepEmpty ? items : items.filter((item) => item.value > 0);
}

function zipSeries(
  start: Date,
  now: Date,
  unit: BucketUnit,
  primary: BucketRow[],
  secondary: BucketRow[],
) {
  const left = fillSeries(start, now, unit, primary);
  const right = fillSeries(start, now, unit, secondary);
  return left.map((point, index) => ({
    at: point.at,
    primary: point.signups,
    secondary: right[index]?.signups ?? 0,
  }));
}

function maskDestination(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return 'پنهان';
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}

function otpMeta(
  row: { consumedAt: Date | null; expiresAt: Date; createdAt: Date },
  now: Date,
) {
  const state = row.consumedAt
    ? 'تأیید شد'
    : new Date(row.expiresAt).getTime() < now.getTime()
      ? 'منقضی'
      : 'معتبر';
  return `${state} · ${agoLabel(new Date(row.createdAt), now).label}`;
}

function clip(value: string) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}
