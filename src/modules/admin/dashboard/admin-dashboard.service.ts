import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Category,
  Order,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Post,
  PostStatus,
  Product,
  ProductStatus,
  RefreshToken,
  RoleSlug,
  User,
} from 'src/entities';
import { Repository } from 'typeorm';
import { orderLabels } from 'src/modules/orders/order-labels';
import { AdminReviewsService } from '../reviews/admin-reviews.service';
import { AdminTicketsService } from '../tickets/admin-tickets.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly reviewsService: AdminReviewsService,
    private readonly ticketsService: AdminTicketsService,
  ) {}

  async getOverview() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const onlineSince = new Date(now.getTime() - 15 * 60 * 1000);

    const [
      totalCustomers,
      totalUsers,
      activeCustomers,
      loginsToday,
      onlineNow,
      totalOrders,
      ordersToday,
      paidOrders,
      revenueRow,
      pendingPaymentOrders,
      failedPaymentOrders,
      awaitingCardReview,
      recentOrderRows,
      reviewStats,
      ticketStats,
      postsTotal,
      postsPublished,
      postsDraft,
      categoriesTotal,
      categoriesActive,
      productsTotal,
      productsActive,
    ] = await Promise.all([
      this.countByRole(RoleSlug.USER),
      this.userRepository.count(),
      this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.userRoles', 'ur')
        .innerJoin('ur.role', 'role')
        .where('role.slug = :slug', { slug: RoleSlug.USER })
        .andWhere('user.isActive = true')
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .where('user.lastLogin >= :start', { start: startOfDay })
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .where('user.lastLogin >= :since', { since: onlineSince })
        .getCount(),
      this.orderRepository.count(),
      this.orderRepository
        .createQueryBuilder('o')
        .where('o.createdAt >= :start', { start: startOfDay })
        .getCount(),
      this.orderRepository.count({
        where: { paymentStatus: PaymentStatus.PAID },
      }),
      this.orderRepository
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total), 0)', 'total')
        .where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID })
        .getRawOne<{ total: string }>(),
      this.orderRepository.count({
        where: { paymentStatus: PaymentStatus.PENDING },
      }),
      this.orderRepository.count({
        where: { paymentStatus: PaymentStatus.FAILED },
      }),
      this.paymentRepository
        .createQueryBuilder('p')
        .where('p.method = :bt', { bt: PaymentMethod.BANK_TRANSFER })
        .andWhere('p.status = :pend', { pend: PaymentStatus.PENDING })
        .andWhere(`p.metadata->>'awaitingAdminReview' = 'true'`)
        .getCount(),
      this.orderRepository
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.user', 'user')
        .leftJoinAndSelect('o.payments', 'payments')
        .orderBy('o.createdAt', 'DESC')
        .take(8)
        .getMany(),
      this.reviewsService.getStats(),
      this.ticketsService.getStats(),
      this.postRepository.count(),
      this.postRepository.count({
        where: { status: PostStatus.PUBLISHED },
      }),
      this.postRepository.count({ where: { status: PostStatus.DRAFT } }),
      this.categoryRepository.count(),
      this.categoryRepository.count({ where: { isActive: true } }),
      this.productRepository.count(),
      this.productRepository.count({
        where: { status: ProductStatus.ACTIVE },
      }),
    ]);

    const activeSessions = await this.refreshTokenRepository
      .createQueryBuilder('rt')
      .where('rt.revokedAt IS NULL')
      .andWhere('rt.expiresAt > :now', { now })
      .getCount();

    const recentOrders = recentOrderRows.map((o) => {
      const payment =
        (o.payments || []).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] || null;
      const awaitingCardReview = Boolean(
        payment?.method === PaymentMethod.BANK_TRANSFER &&
          payment.status === PaymentStatus.PENDING &&
          (payment.metadata as any)?.awaitingAdminReview,
      );
      return {
        uuid: o.uuid,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: Number(o.total),
        createdAt: o.createdAt,
        paymentMethod: payment?.method ?? null,
        awaitingCardReview,
        customer: o.user
          ? {
              firstName: (o.user as User).firstName,
              lastName: (o.user as User).lastName,
              phone: (o.user as User).phone,
            }
          : null,
        labels: orderLabels({
          status: o.status,
          paymentStatus: o.paymentStatus,
          paymentMethod: payment?.method ?? null,
          awaitingCardReview,
          hasReceipt: Boolean((payment?.metadata as any)?.receiptFileUuid),
        }),
      };
    });

    return {
      success: true,
      data: {
        customers: {
          total: totalCustomers,
          active: activeCustomers,
        },
        users: {
          total: totalUsers,
        },
        sessions: {
          loginsToday,
          onlineNow,
          activeRefreshTokens: activeSessions,
          onlineWindowMinutes: 15,
        },
        orders: {
          total: totalOrders,
          today: ordersToday,
          paid: paidOrders,
          pendingPayment: pendingPaymentOrders,
          failedPayment: failedPaymentOrders,
          awaitingCardReview,
          revenuePaid: Number(revenueRow?.total ?? 0),
          currency: 'IRR',
          recent: recentOrders,
        },
        content: {
          posts: {
            total: postsTotal,
            published: postsPublished,
            draft: postsDraft,
          },
          categories: {
            total: categoriesTotal,
            active: categoriesActive,
          },
          products: {
            total: productsTotal,
            active: productsActive,
          },
        },
        reviews: reviewStats,
        tickets: ticketStats,
        services: [
          {
            key: 'auth',
            label: 'احراز هویت',
            status: 'up',
            detail: `${loginsToday} ورود امروز`,
          },
          {
            key: 'customers',
            label: 'مشتریان',
            status: 'up',
            detail: `${totalCustomers} مشتری`,
          },
          {
            key: 'catalog',
            label: 'کاتالوگ',
            status: 'up',
            detail: `${productsActive} محصول · ${categoriesActive} دسته`,
          },
          {
            key: 'blog',
            label: 'مجله',
            status: 'up',
            detail: `${postsPublished} مقاله منتشر`,
          },
          {
            key: 'orders',
            label: 'سفارش‌ها',
            status: awaitingCardReview > 0 ? 'warn' : 'up',
            detail:
              awaitingCardReview > 0
                ? `${awaitingCardReview} فیش در انتظار`
                : `${ordersToday} سفارش امروز`,
          },
          {
            key: 'reviews',
            label: 'کامنت‌ها',
            status: 'up',
            detail: `${reviewStats.unanswered} بدون جواب`,
          },
          {
            key: 'tickets',
            label: 'تیکت‌ها',
            status: ticketStats.awaiting > 0 ? 'warn' : 'up',
            detail: `${ticketStats.awaiting} در انتظار`,
          },
          {
            key: 'sessions',
            label: 'نشست‌ها',
            status: 'up',
            detail: `${activeSessions} توکن فعال`,
          },
        ],
        generatedAt: now.toISOString(),
      },
    };
  }

  async getCustomerAnalytics(range: DashboardRange) {
    const now = new Date();
    const { start, unit } = resolveRange(range, now);
    const base = () =>
      this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.userRoles', 'ur')
        .innerJoin('ur.role', 'role')
        .where('role.slug = :slug', { slug: RoleSlug.USER });

    const inRange = () =>
      base().andWhere('user.createdAt >= :start', { start });

    const [
      allTime,
      signedUp,
      withEmail,
      neverLoggedIn,
      inactiveUnverified,
      verified,
      loggedInDuring,
      seriesRows,
      recentSignups,
      recentLogins,
    ] = await Promise.all([
      base().getCount(),
      inRange().getCount(),
      inRange()
        .andWhere(`NULLIF(BTRIM(user.email), '') IS NOT NULL`)
        .getCount(),
      inRange().andWhere('user.lastLogin IS NULL').getCount(),
      inRange()
        .andWhere('user.isActive = false')
        .andWhere('user.isVerified = false')
        .getCount(),
      inRange().andWhere('user.isVerified = true').getCount(),
      base()
        .andWhere('user.lastLogin IS NOT NULL')
        .andWhere('user.lastLogin >= :start', { start })
        .getCount(),
      inRange()
        .select(`date_trunc('${unit}', user.createdAt)`, 'bucket')
        .addSelect('COUNT(*)', 'count')
        .groupBy('bucket')
        .orderBy('bucket', 'ASC')
        .getRawMany<{ bucket: Date | string; count: string }>(),
      inRange()
        .select([
          'user.id',
          'user.uuid',
          'user.firstName',
          'user.lastName',
          'user.phone',
          'user.createdAt',
          'user.lastLogin',
        ])
        .orderBy('user.createdAt', 'DESC')
        .take(8)
        .getMany(),
      base()
        .andWhere('user.lastLogin IS NOT NULL')
        .andWhere('user.lastLogin >= :start', { start })
        .select([
          'user.id',
          'user.uuid',
          'user.firstName',
          'user.lastName',
          'user.phone',
          'user.lastLogin',
        ])
        .orderBy('user.lastLogin', 'DESC')
        .take(10)
        .getMany(),
    ]);

    const series = fillSeries(start, now, unit, seriesRows);
    let running = Math.max(0, allTime - signedUp);
    const points = series.map((point) => {
      running += point.signups;
      return { ...point, cumulative: running };
    });

    return {
      success: true,
      data: {
        range,
        from: start.toISOString(),
        to: now.toISOString(),
        unit,
        totals: {
          allTime,
          signedUp,
          withEmail,
          neverLoggedIn,
          inactiveUnverified,
          verified,
          loggedInDuring,
        },
        series: points,
        recentSignups: recentSignups.map((user) =>
          mapCustomerRow(user, now, 'created'),
        ),
        recentLogins: recentLogins.map((user) =>
          mapCustomerRow(user, now, 'login'),
        ),
      },
    };
  }

  private countByRole(slug: RoleSlug) {
    return this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .where('role.slug = :slug', { slug })
      .getCount();
  }
}

export type BucketUnit = 'hour' | 'day' | 'week' | 'month';

export const DASHBOARD_RANGES = [
  'today',
  '7d',
  '30d',
  '90d',
  '180d',
  '365d',
] as const;

export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export function resolveRange(range: DashboardRange, now: Date) {
  const start = new Date(now);
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
    return { start, unit: 'hour' as BucketUnit };
  }
  const days =
    range === '7d'
      ? 6
      : range === '30d'
        ? 29
        : range === '90d'
          ? 89
          : range === '180d'
            ? 179
            : 364;
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const unit: BucketUnit =
    range === '365d' ? 'month' : range === '90d' || range === '180d' ? 'week' : 'day';
  return { start, unit };
}

function truncate(date: Date, unit: BucketUnit) {
  const x = new Date(date);
  if (unit === 'hour') {
    x.setMinutes(0, 0, 0);
    return x;
  }
  if (unit === 'month') {
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  if (unit === 'week') {
    const day = x.getDay();
    const diff = (day + 6) % 7;
    x.setDate(x.getDate() - diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  x.setHours(0, 0, 0, 0);
  return x;
}

function addUnit(date: Date, unit: BucketUnit) {
  const x = new Date(date);
  if (unit === 'hour') x.setHours(x.getHours() + 1);
  else if (unit === 'week') x.setDate(x.getDate() + 7);
  else if (unit === 'month') x.setMonth(x.getMonth() + 1);
  else x.setDate(x.getDate() + 1);
  return x;
}

export function fillSeries(
  start: Date,
  now: Date,
  unit: BucketUnit,
  rows: { bucket: Date | string; count: string }[],
) {
  const counts = new Map<number, number>();
  for (const row of rows) {
    const at = truncate(new Date(row.bucket), unit).getTime();
    counts.set(at, Number(row.count) || 0);
  }
  const points: { at: string; signups: number }[] = [];
  let cursor = truncate(start, unit);
  const end = truncate(now, unit);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 400) {
    points.push({
      at: cursor.toISOString(),
      signups: counts.get(cursor.getTime()) ?? 0,
    });
    cursor = addUnit(cursor, unit);
    guard += 1;
  }
  return points;
}

export function agoLabel(from: Date, now: Date) {
  const ms = Math.max(0, now.getTime() - from.getTime());
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(ms / 3_600_000);
    if (hours <= 0) return { days: 0, label: 'همین الان' };
    return { days: 0, label: `${hours} ساعت پیش` };
  }
  return { days, label: `${days} روز پیش` };
}

function mapCustomerRow(
  user: User,
  now: Date,
  kind: 'created' | 'login',
) {
  const stamp = kind === 'login' ? user.lastLogin : user.createdAt;
  const ago = stamp ? agoLabel(new Date(stamp), now) : { days: null, label: '—' };
  return {
    uuid: user.uuid,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    at: stamp ? new Date(stamp).toISOString() : null,
    daysAgo: ago.days,
    agoLabel: ago.label,
  };
}
