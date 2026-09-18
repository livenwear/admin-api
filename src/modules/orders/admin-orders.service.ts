import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Shipment,
  ShipmentStatus,
  User,
} from 'src/entities';
import { Brackets, Repository } from 'typeorm';
import { CheckoutService } from './checkout.service';
import { orderLabels } from './order-labels';
import {
  AdminListOrdersQueryDto,
  AdminRejectPaymentDto,
  AdminUpdateOrderStatusDto,
} from './dto/admin-orders.dto';

@Injectable()
export class AdminOrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    private readonly checkoutService: CheckoutService,
  ) {}

  async list(query: AdminListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'user')
      .leftJoinAndSelect('o.payments', 'payments')
      .leftJoinAndSelect('o.items', 'items')
      .orderBy('o.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }
    if (query.paymentStatus) {
      qb.andWhere('o.paymentStatus = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }
    if (query.paymentMethod) {
      qb.andWhere('payments.method = :pm', { pm: query.paymentMethod });
    }
    if (query.awaitingCardReview === 'true') {
      qb.andWhere('payments.method = :bt', { bt: PaymentMethod.BANK_TRANSFER });
      qb.andWhere('payments.status = :pend', { pend: PaymentStatus.PENDING });
      qb.andWhere(
        `payments.metadata->>'awaitingAdminReview' = 'true'`,
      );
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('o.orderNumber ILIKE :term', { term })
            .orWhere('user.phone ILIKE :term', { term })
            .orWhere('user.firstName ILIKE :term', { term })
            .orWhere('user.lastName ILIKE :term', { term })
            .orWhere('user.email ILIKE :term', { term });
        }),
      );
    }

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    const awaitingCount = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.method = :m', { m: PaymentMethod.BANK_TRANSFER })
      .andWhere('p.status = :s', { s: PaymentStatus.PENDING })
      .andWhere(`p.metadata->>'awaitingAdminReview' = 'true'`)
      .getCount();

    return {
      success: true,
      data: rows.map((o) => {
        const payment = (o.payments || [])[0];
        return {
          uuid: o.uuid,
          orderNumber: o.orderNumber,
          status: o.status,
          paymentStatus: o.paymentStatus,
          total: Number(o.total),
          shippingAmount: Number(o.shippingAmount),
          shippingMethodCode: o.shippingMethodCode,
          shippingMethodTitle: o.shippingMethodTitle,
          itemCount: (o.items || []).reduce((s, i) => s + i.quantity, 0),
          createdAt: o.createdAt,
          paymentMethod: payment?.method ?? null,
          awaitingCardReview: Boolean(
            payment?.method === PaymentMethod.BANK_TRANSFER &&
              payment.status === PaymentStatus.PENDING &&
              (payment.metadata as any)?.awaitingAdminReview,
          ),
          customer: o.user
            ? {
                uuid: (o.user as User).uuid,
                firstName: (o.user as User).firstName,
                lastName: (o.user as User).lastName,
                phone: (o.user as User).phone,
              }
            : null,
          labels: orderLabels({
            status: o.status,
            paymentStatus: o.paymentStatus,
            paymentMethod: payment?.method ?? null,
            awaitingCardReview: Boolean(
              payment?.method === PaymentMethod.BANK_TRANSFER &&
                payment.status === PaymentStatus.PENDING &&
                (payment.metadata as any)?.awaitingAdminReview,
            ),
            hasReceipt: Boolean((payment?.metadata as any)?.receiptFileUuid),
          }),
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        from,
        to,
        awaitingCardReview: awaitingCount,
      },
    };
  }

  async summary() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      total,
      today,
      byStatusRaw,
      byPaymentStatusRaw,
      byMethodRaw,
      awaitingCardReview,
    ] = await Promise.all([
      this.orderRepo.count(),
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.createdAt >= :start', { start: startOfDay })
        .getCount(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.status', 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.status')
        .getRawMany<{ key: string; count: string }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.paymentStatus', 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.paymentStatus')
        .getRawMany<{ key: string; count: string }>(),
      this.paymentRepo
        .createQueryBuilder('p')
        .innerJoin('p.order', 'o')
        .select('p.method', 'key')
        .addSelect('COUNT(DISTINCT o.id)', 'count')
        .groupBy('p.method')
        .getRawMany<{ key: string; count: string }>(),
      this.paymentRepo
        .createQueryBuilder('p')
        .where('p.method = :bt', { bt: PaymentMethod.BANK_TRANSFER })
        .andWhere('p.status = :pend', { pend: PaymentStatus.PENDING })
        .andWhere(`p.metadata->>'awaitingAdminReview' = 'true'`)
        .getCount(),
    ]);

    const toMap = (rows: Array<{ key: string; count: string }>) =>
      Object.fromEntries(
        rows.map((r) => [r.key, Number(r.count)]),
      ) as Record<string, number>;

    const byStatus = toMap(byStatusRaw);
    const byPaymentStatus = toMap(byPaymentStatusRaw);
    const byPaymentMethod = toMap(byMethodRaw);

    return {
      success: true,
      data: {
        total,
        today,
        awaitingCardReview,
        byStatus: Object.entries(byStatus).map(([key, count]) => ({
          key,
          count,
          label: orderLabels({
            status: key,
            paymentStatus: PaymentStatus.PAID,
          }).status,
        })),
        byPaymentStatus: Object.entries(byPaymentStatus).map(
          ([key, count]) => ({
            key,
            count,
            label: orderLabels({
              status: OrderStatus.PENDING,
              paymentStatus: key,
            }).paymentStatus,
          }),
        ),
        byPaymentMethod: Object.entries(byPaymentMethod).map(
          ([key, count]) => ({
            key,
            count,
            label: orderLabels({
              status: OrderStatus.PENDING,
              paymentStatus: PaymentStatus.PENDING,
              paymentMethod: key,
            }).paymentMethod,
          }),
        ),
      },
    };
  }

  async detail(uuid: string) {
    const data = await this.checkoutService.mapOrderDetail(uuid);
    return { success: true, data };
  }

  async approveCardPayment(orderUuid: string, admin: User) {
    const order = await this.orderRepo.findOne({
      where: { uuid: orderUuid },
      relations: ['payments', 'items'],
    });
    if (!order) throw new NotFoundException('سفارش یافت نشد.');
    const payment = (order.payments || []).find(
      (p) =>
        p.method === PaymentMethod.BANK_TRANSFER &&
        p.status === PaymentStatus.PENDING,
    );
    if (!payment) {
      throw new BadRequestException('پرداخت کارت‌به‌کارت در انتظار نیست.');
    }
    if (!(payment.metadata as any)?.receiptFileUuid) {
      throw new BadRequestException('رسید پرداخت هنوز بارگذاری نشده است.');
    }

    await this.checkoutService.markOrderPaid(order.id, payment.id, {
      approvedByAdmin: true,
      approvedAt: new Date().toISOString(),
    }, admin.id);

    return this.detail(orderUuid);
  }

  async rejectCardPayment(
    orderUuid: string,
    dto: AdminRejectPaymentDto,
    admin: User,
  ) {
    const order = await this.orderRepo.findOne({
      where: { uuid: orderUuid },
      relations: ['payments', 'items'],
    });
    if (!order) throw new NotFoundException('سفارش یافت نشد.');
    const payment = (order.payments || []).find(
      (p) =>
        p.method === PaymentMethod.BANK_TRANSFER &&
        p.status === PaymentStatus.PENDING,
    );
    if (!payment) {
      throw new BadRequestException('پرداخت کارت‌به‌کارت در انتظار نیست.');
    }

    await this.checkoutService.rejectCardPayment(
      order.id,
      payment.id,
      dto.reason,
      admin.id,
    );
    return this.detail(orderUuid);
  }

  async updateStatus(orderUuid: string, dto: AdminUpdateOrderStatusDto) {
    const order = await this.orderRepo.findOne({
      where: { uuid: orderUuid },
      relations: ['shipments'],
    });
    if (!order) throw new NotFoundException('سفارش یافت نشد.');

    if (
      order.paymentStatus !== PaymentStatus.PAID &&
      ![OrderStatus.CANCELLED, OrderStatus.PENDING].includes(dto.status) &&
      dto.status !== order.status
    ) {
      if (
        [
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ].includes(dto.status)
      ) {
        throw new BadRequestException(
          'تا قبل از پرداخت موفق، تغییر وضعیت ارسال مجاز نیست.',
        );
      }
    }

    order.status = dto.status;
    await this.orderRepo.save(order);

    const shipment = (order.shipments || [])[0];
    if (shipment) {
      if (dto.trackingNumber) {
        shipment.trackingNumber = dto.trackingNumber;
      }
      if (dto.status === OrderStatus.SHIPPED) {
        shipment.status = ShipmentStatus.SHIPPED;
        shipment.shippedAt = shipment.shippedAt || new Date();
      }
      if (dto.status === OrderStatus.DELIVERED) {
        shipment.status = ShipmentStatus.DELIVERED;
        shipment.deliveredAt = shipment.deliveredAt || new Date();
      }
      if (dto.status === OrderStatus.PROCESSING) {
        shipment.status = ShipmentStatus.PROCESSING;
      }
      await this.shipmentRepo.save(shipment);
    }

    return this.detail(orderUuid);
  }
}
