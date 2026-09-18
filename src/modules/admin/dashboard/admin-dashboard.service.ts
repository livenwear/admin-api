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

  private countByRole(slug: RoleSlug) {
    return this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .where('role.slug = :slug', { slug })
      .getCount();
  }
}
