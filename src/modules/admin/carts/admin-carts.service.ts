import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cart, CartItem, Order, ProductVariant, User } from 'src/entities';
import { PaymentStatus, ProductStatus } from 'src/entities/enums';
import { In, Repository } from 'typeorm';

type PurchaseStatus = 'in_cart' | 'empty' | 'purchased';

@Injectable()
export class AdminCartsService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly itemRepo: Repository<CartItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async list(query: {
    page?: number;
    limit?: number;
    q?: string;
    status?: 'all' | 'active' | 'empty' | 'purchased';
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const status = query.status || 'all';

    const qb = this.cartRepo
      .createQueryBuilder('cart')
      .leftJoinAndSelect('cart.user', 'user')
      .orderBy('cart.updatedAt', 'DESC');

    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      qb.andWhere(
        `(user.phone ILIKE :q OR user.firstName ILIKE :q OR user.lastName ILIKE :q OR cart.guestToken ILIKE :q OR CAST(cart.uuid AS text) ILIKE :q)`,
        { q },
      );
    }
    if (query.dateFrom) {
      qb.andWhere('cart.updatedAt >= :from', {
        from: new Date(`${query.dateFrom}T00:00:00.000Z`),
      });
    }
    if (query.dateTo) {
      qb.andWhere('cart.updatedAt <= :to', {
        to: new Date(`${query.dateTo}T23:59:59.999Z`),
      });
    }

    const all = await qb.getMany();

    const cartIds = all.map((c) => c.id);
    const linesByCart = new Map<number, CartItem[]>();
    if (cartIds.length) {
      const lines = await this.itemRepo
        .createQueryBuilder('item')
        .innerJoinAndSelect('item.variant', 'variant')
        .innerJoinAndSelect('variant.product', 'product')
        .leftJoinAndSelect('variant.prices', 'prices')
        .where('item.cartId IN (:...ids)', { ids: cartIds })
        .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
        .orderBy('item.createdAt', 'DESC')
        .getMany();
      for (const line of lines) {
        const list = linesByCart.get(line.cartId) || [];
        list.push(line);
        linesByCart.set(line.cartId, list);
      }
    }

    const userIds = all
      .map((c) => c.userId)
      .filter((id): id is number => id != null);
    const purchasedUserIds = new Set<number>();
    if (userIds.length) {
      const paid = await this.orderRepo.find({
        where: {
          userId: In(userIds),
          paymentStatus: PaymentStatus.PAID,
        },
        select: ['userId'],
      });
      for (const row of paid) {
        if (row.userId) purchasedUserIds.add(row.userId);
      }
    }

    const paymentRaw = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.paymentStatus', 'paymentStatus')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.paymentStatus')
      .getRawMany<{ paymentStatus: PaymentStatus; count: string }>();

    const paymentCounts: Record<string, number> = {
      pending: 0,
      paid: 0,
      failed: 0,
      refunded: 0,
      partially_refunded: 0,
    };
    for (const row of paymentRaw) {
      paymentCounts[row.paymentStatus] = Number(row.count) || 0;
    }

    let rows = all.map((cart) => {
      const user = cart.user as User | undefined;
      const lines = linesByCart.get(cart.id) || [];
      const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
      const hasPurchased =
        cart.userId != null && purchasedUserIds.has(cart.userId);

      let purchaseStatus: PurchaseStatus = 'empty';
      if (hasPurchased) purchaseStatus = 'purchased';
      else if (itemCount > 0) purchaseStatus = 'in_cart';

      const preview = lines.slice(0, 4).map((item) => {
        const variant = item.variant as ProductVariant;
        const product = (variant as any).product;
        const prices = (variant as any).prices || [];
        const active =
          prices.find((p: { isActive?: boolean }) => p.isActive) || prices[0];
        return {
          quantity: item.quantity,
          productName: product?.name || '—',
          productUuid: product?.uuid || null,
          variantTitle: variant?.title || null,
          unitPrice: active ? Number(active.amount) : 0,
        };
      });

      return {
        uuid: cart.uuid,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
        guestToken: cart.guestToken,
        lineCount: lines.length,
        itemCount,
        purchaseStatus,
        user: user
          ? {
              uuid: user.uuid,
              firstName: user.firstName,
              lastName: user.lastName,
              phone: user.phone,
            }
          : null,
        preview,
      };
    });

    const statusBuckets = {
      in_cart: { carts: 0, items: 0 },
      empty: { carts: 0, items: 0 },
      purchased: { carts: 0, items: 0 },
    };
    let totalItemsAll = 0;
    for (const row of rows) {
      statusBuckets[row.purchaseStatus].carts += 1;
      statusBuckets[row.purchaseStatus].items += row.itemCount;
      totalItemsAll += row.itemCount;
    }

    const summary = {
      totalCarts: rows.length,
      totalItems: totalItemsAll,
      byStatus: statusBuckets,
      payments: {
        pending: paymentCounts.pending || 0,
        paid: paymentCounts.paid || 0,
        failed: paymentCounts.failed || 0,
        refunded:
          (paymentCounts.refunded || 0) +
          (paymentCounts.partially_refunded || 0),
      },
    };

    if (status === 'active') {
      rows = rows.filter((r) => r.purchaseStatus === 'in_cart');
    } else if (status === 'empty') {
      rows = rows.filter((r) => r.purchaseStatus === 'empty');
    } else if (status === 'purchased') {
      rows = rows.filter((r) => r.purchaseStatus === 'purchased');
    }

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const slice = rows.slice((page - 1) * limit, page * limit);

    return {
      success: true,
      data: slice,
      summary,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        from: total === 0 ? 0 : (page - 1) * limit + 1,
        to: total === 0 ? 0 : Math.min(page * limit, total),
      },
    };
  }
}
