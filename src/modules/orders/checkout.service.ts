import { createHmac, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Address,
  Cart,
  CartItem,
  FileEntity,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Price,
  Product,
  ProductStatus,
  ProductVariant,
  Shipment,
  ShipmentStatus,
  User,
} from 'src/entities';
import { DataSource, Repository } from 'typeorm';
import { StorageService } from 'src/storage/storage.service';
import { CommerceSettingsService } from './commerce-settings.service';
import { resolveShippingFee } from './commerce-settings.types';
import { orderLabels } from './order-labels';
import { OrderInventoryService } from './order-inventory.service';
import { PlaceOrderDto } from './dto/place-order.dto';

function money(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly settingsService: CommerceSettingsService,
    private readonly inventoryService: OrderInventoryService,
    private readonly storageService: StorageService,
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  /** Remove receipt object from MinIO + soft-delete FileEntity */
  private async destroyReceiptFile(fileUuid: string | null | undefined) {
    if (!fileUuid) return;
    const file = await this.fileRepo.findOne({ where: { uuid: fileUuid } });
    if (!file) return;
    try {
      await this.storageService.delete(file.bucket, file.objectKey);
    } catch {
      // already missing in storage — still clean DB
    }
    await this.fileRepo.softRemove(file);
  }

  private hmacSecret() {
    return (
      this.config.get<string>('PAYMENT_SIMULATOR_SECRET') ||
      this.config.get<string>('JWT_SECRET_KEY') ||
      'liven-dev-payment-secret'
    );
  }

  createSimulatorToken(paymentUuid: string, orderUuid: string, exp: number) {
    return createHmac('sha256', this.hmacSecret())
      .update(`${paymentUuid}.${orderUuid}.${exp}`)
      .digest('hex');
  }

  verifySimulatorToken(
    paymentUuid: string,
    orderUuid: string,
    exp: number,
    token: string,
    opts?: { allowExpired?: boolean },
  ) {
    if (!token || !exp) return false;
    if (!opts?.allowExpired && exp < Date.now()) return false;
    const expected = this.createSimulatorToken(paymentUuid, orderUuid, exp);
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(String(token), 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /** Mint or reuse a valid simulator token for pending online payments */
  private async ensureSimulatorToken(payment: Payment, orderUuid: string) {
    const meta = { ...(payment.metadata || {}) } as Record<string, unknown>;
    const token = String(meta.token || '');
    const tokenExp = Number(meta.tokenExp || 0);
    if (
      this.verifySimulatorToken(payment.uuid, orderUuid, tokenExp, token)
    ) {
      return { token, tokenExp };
    }
    const exp = Date.now() + 30 * 60 * 1000;
    const fresh = this.createSimulatorToken(payment.uuid, orderUuid, exp);
    payment.metadata = {
      ...meta,
      provider: 'simulator',
      token: fresh,
      tokenExp: exp,
    };
    await this.paymentRepo.save(payment);
    return { token: fresh, tokenExp: exp };
  }

  private async generateOrderNumber(manager: DataSource['manager']) {
    for (let i = 0; i < 8; i++) {
      const n = `LM${Date.now().toString().slice(-10)}${Math.floor(
        Math.random() * 90 + 10,
      )}`;
      const exists = await manager.getRepository(Order).exist({
        where: { orderNumber: n },
      });
      if (!exists) return n;
    }
    throw new BadRequestException('ساخت شماره سفارش ناموفق بود.');
  }

  async getOptions(user: User) {
    const settings = await this.settingsService.get();
    const cart = await this.cartRepo.findOne({ where: { userId: user.id } });
    if (!cart) {
      return {
        success: true,
        data: {
          cart: { items: [], totals: null },
          shippingMethods: [],
          paymentMethods: [],
          cardTransfer: null,
        },
      };
    }

    const built = await this.buildCartSnapshot(cart.id);
    const addresses = await this.addressRepo.find({
      where: { userId: user.id },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    const paymentMethods: Array<{
      code: 'online' | 'bank_transfer';
      title: string;
      description: string;
      enabled: boolean;
    }> = [
      {
        code: 'online',
        title: 'پرداخت آنلاین',
        description: 'پرداخت امن از طریق درگاه بانکی (شبیه‌ساز)',
        enabled: settings.onlineGateway.enabled,
      },
      {
        code: 'bank_transfer',
        title: 'کارت به کارت',
        description: 'واریز به کارت و ارسال رسید برای تایید ادمین',
        enabled: settings.cardTransfer.enabled,
      },
    ];

    return {
      success: true,
      data: {
        cart: built,
        addresses: addresses.map((a) => this.mapAddress(a)),
        shippingMethods: settings.shippingMethods
          .filter((m) => m.enabled)
          .map((m) => ({
            code: m.code,
            title: m.title,
            fee: m.fee,
            tehranFee: m.tehranFee ?? null,
            otherCitiesFee: m.otherCitiesFee ?? null,
            useRegionPricing: Boolean(m.useRegionPricing),
            etaText: m.etaText,
            description: m.description ?? null,
            logoFileUuid: m.logoFileUuid ?? null,
            logoUrl: m.logoUrl ?? m.logoFileUuid ?? null,
          })),
        paymentMethods: paymentMethods.filter((p) => p.enabled),
        cardTransfer: settings.cardTransfer.enabled
          ? {
              cardNumber: settings.cardTransfer.cardNumber,
              cardHolderName: settings.cardTransfer.cardHolderName,
              bankName: settings.cardTransfer.bankName,
              instructions: settings.cardTransfer.instructions,
            }
          : null,
      },
    };
  }

  private mapAddress(a: Address) {
    return {
      uuid: a.uuid,
      title: a.title,
      firstName: a.firstName,
      lastName: a.lastName,
      phone: a.phone,
      province: a.province,
      city: a.city,
      addressLine1: a.addressLine1,
      plaque: a.plaque,
      unit: a.unit,
      postalCode: a.postalCode,
      isDefault: a.isDefault,
    };
  }

  private async buildCartSnapshot(cartId: number) {
    const items = await this.dataSource
      .getRepository(CartItem)
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.variant', 'variant')
      .innerJoinAndSelect('variant.product', 'product')
      .leftJoinAndSelect('variant.prices', 'prices')
      .leftJoinAndSelect('variant.inventories', 'inventories')
      .leftJoinAndSelect(
        'variant.variantAttributeValues',
        'vav',
      )
      .leftJoinAndSelect('vav.attributeValue', 'attrVal')
      .leftJoinAndSelect('attrVal.attribute', 'attr')
      .where('item.cart_id = :cartId', { cartId })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('variant.isActive = true')
      .getMany();

    const lines = items.map((item) => {
      const variant = item.variant as ProductVariant;
      const product = variant.product as Product;
      const price =
        (variant.prices || []).find((p: Price) => p.isActive) ||
        variant.prices?.[0];
      const unitPrice = price ? Number(price.amount) : 0;
      const compareAt = price?.compareAtAmount
        ? Number(price.compareAtAmount)
        : null;
      const inv = (variant.inventories || [])[0];
      const available = inv
        ? Math.max(0, inv.quantity - inv.reservedQuantity)
        : 0;
      const attrs = (variant.variantAttributeValues || []).map((vav: any) => ({
        name: vav.attributeValue?.attribute?.name,
        value: vav.attributeValue?.value,
      }));

      return {
        variantId: variant.id,
        variantUuid: variant.uuid,
        productId: product.id,
        productUuid: product.uuid,
        productName: product.name,
        sku: variant.sku,
        quantity: item.quantity,
        unitPrice,
        compareAtPrice: compareAt,
        lineTotal: unitPrice * item.quantity,
        isUnavailable: Boolean(product.isUnavailable),
        available,
        stockOk: available >= item.quantity,
        attributes: attrs,
      };
    });

    const unavailable = lines.filter((l) => l.isUnavailable);
    const stockIssues = lines.filter((l) => !l.stockOk);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

    return {
      items: lines.map((l) => ({
        variantUuid: l.variantUuid,
        productUuid: l.productUuid,
        productName: l.productName,
        sku: l.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        compareAtPrice: l.compareAtPrice,
        lineTotal: l.lineTotal,
        isUnavailable: l.isUnavailable,
        available: l.available,
        stockOk: l.stockOk,
        attributes: l.attributes,
      })),
      totals: {
        lineCount: lines.length,
        itemCount: lines.reduce((s, l) => s + l.quantity, 0),
        subtotal,
        currency: 'IRR',
        canCheckout:
          lines.length > 0 &&
          unavailable.length === 0 &&
          stockIssues.length === 0,
        blockedReason:
          unavailable.length > 0
            ? 'برخی کالاها ناموجود علامت خورده‌اند.'
            : stockIssues.length > 0
              ? 'موجودی برخی کالاها کافی نیست.'
              : lines.length === 0
                ? 'سبد خرید خالی است.'
                : null,
      },
      _internalLines: lines,
    };
  }

  async quoteShipping(user: User, addressUuid: string, shippingMethodCode: string) {
    const address = await this.addressRepo.findOne({
      where: { uuid: addressUuid, userId: user.id },
    });
    if (!address) throw new NotFoundException('آدرس یافت نشد.');
    const method = await this.settingsService.getShippingMethod(shippingMethodCode);
    if (!method) throw new BadRequestException('روش ارسال فعال نیست.');
    const fee = resolveShippingFee(method, address.province);
    return {
      success: true,
      data: {
        code: method.code,
        title: method.title,
        fee,
        etaText: method.etaText,
      },
    };
  }

  async placeOrder(user: User, dto: PlaceOrderDto) {
    const settings = await this.settingsService.get();
    const payMethod =
      dto.paymentMethod === 'online'
        ? PaymentMethod.ONLINE
        : PaymentMethod.BANK_TRANSFER;

    if (payMethod === PaymentMethod.ONLINE && !settings.onlineGateway.enabled) {
      throw new BadRequestException('پرداخت آنلاین غیرفعال است.');
    }
    if (
      payMethod === PaymentMethod.BANK_TRANSFER &&
      !settings.cardTransfer.enabled
    ) {
      throw new BadRequestException('پرداخت کارت‌به‌کارت غیرفعال است.');
    }

    const address = await this.addressRepo.findOne({
      where: { uuid: dto.addressUuid, userId: user.id },
    });
    if (!address) throw new NotFoundException('آدرس یافت نشد.');

    const shippingMethod = await this.settingsService.getShippingMethod(
      dto.shippingMethodCode,
    );
    if (!shippingMethod) {
      throw new BadRequestException('روش ارسال انتخاب‌شده فعال نیست.');
    }

    const cart = await this.cartRepo.findOne({ where: { userId: user.id } });
    if (!cart) throw new BadRequestException('سبد خرید خالی است.');

    const snapshot = await this.buildCartSnapshot(cart.id);
    if (!snapshot.totals.canCheckout) {
      throw new BadRequestException(
        snapshot.totals.blockedReason || 'امکان ثبت سفارش نیست.',
      );
    }

    const shippingFee = resolveShippingFee(shippingMethod, address.province);
    const subtotal = snapshot.totals.subtotal;
    const total = subtotal + shippingFee;
    const addressSnap = {
      uuid: address.uuid,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      province: address.province,
      city: address.city,
      addressLine1: address.addressLine1,
      plaque: address.plaque,
      unit: address.unit,
      postalCode: address.postalCode,
    };

    const result = await this.dataSource.transaction(async (manager) => {
      const orderNumber = await this.generateOrderNumber(manager);
      const order = await manager.getRepository(Order).save(
        manager.getRepository(Order).create({
          orderNumber,
          userId: user.id,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: money(subtotal),
          discountAmount: money(0),
          shippingAmount: money(shippingFee),
          taxAmount: money(0),
          total: money(total),
          currency: 'IRR',
          shippingAddress: addressSnap,
          billingAddress: addressSnap,
          note: dto.note?.trim() || null,
          shippingMethodCode: shippingMethod.code,
          shippingMethodTitle: shippingMethod.title,
          metadata: {
            stockState: 'reserved',
            placedAt: new Date().toISOString(),
          },
        }),
      );

      for (const line of snapshot._internalLines) {
        await manager.getRepository(OrderItem).save(
          manager.getRepository(OrderItem).create({
            orderId: order.id,
            productId: line.productId,
            variantId: line.variantId,
            productName: line.productName,
            sku: line.sku,
            quantity: line.quantity,
            unitPrice: money(line.unitPrice),
            totalPrice: money(line.lineTotal),
            attributesSnapshot: { attributes: line.attributes },
          }),
        );
      }

      await this.inventoryService.reserveLines(
        manager,
        snapshot._internalLines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
        })),
        order.id,
      );

      await manager.getRepository(Shipment).save(
        manager.getRepository(Shipment).create({
          orderId: order.id,
          status: ShipmentStatus.PENDING,
          carrier: shippingMethod.code,
          trackingNumber: null,
          address: {
            ...addressSnap,
            methodTitle: shippingMethod.title,
            fee: shippingFee,
            etaText: shippingMethod.etaText,
          },
        }),
      );

      const exp = Date.now() + 30 * 60 * 1000;
      const payment = await manager.getRepository(Payment).save(
        manager.getRepository(Payment).create({
          orderId: order.id,
          amount: money(total),
          method: payMethod,
          status: PaymentStatus.PENDING,
          transactionId: null,
          paidAt: null,
          metadata:
            payMethod === PaymentMethod.ONLINE
              ? {
                  provider: 'simulator',
                  tokenExp: exp,
                  token: this.createSimulatorToken(order.uuid, order.uuid, exp),
                }
              : {
                  provider: 'card_transfer',
                  awaitingAdminReview: false,
                  receiptFileUuid: null,
                },
        }),
      );

      // Fix simulator token to use payment.uuid (order.uuid was placeholder)
      if (payMethod === PaymentMethod.ONLINE) {
        const token = this.createSimulatorToken(payment.uuid, order.uuid, exp);
        payment.metadata = {
          provider: 'simulator',
          tokenExp: exp,
          token,
        };
        payment.transactionId = `SIM-${payment.uuid.slice(0, 8)}`;
        await manager.getRepository(Payment).save(payment);
      }

      // Clear cart items
      await manager
        .getRepository(CartItem)
        .createQueryBuilder()
        .delete()
        .where('cart_id = :cartId', { cartId: cart.id })
        .execute();

      return { order, payment };
    });

    return {
      success: true,
      data: await this.mapOrderDetail(result.order.uuid, user.id),
    };
  }

  async mapOrderDetail(orderUuid: string, userId?: number | null) {
    const order = await this.orderRepo.findOne({
      where: { uuid: orderUuid },
      relations: [
        'items',
        'items.product',
        'payments',
        'shipments',
        'user',
      ],
    });
    if (!order) throw new NotFoundException('سفارش یافت نشد.');
    if (userId != null && order.userId !== userId) {
      throw new ForbiddenException('دسترسی به این سفارش مجاز نیست.');
    }

    const payment =
      (order.payments || []).sort(
        (a: Payment, b: Payment) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0] || null;
    const shipment = (order.shipments || [])[0] || null;
    const settings = await this.settingsService.get();

    const meta = (payment?.metadata || {}) as Record<string, unknown>;
    const awaitingCardReview = Boolean(meta.awaitingAdminReview);
    const hasReceipt = Boolean(meta.receiptFileUuid);

    let nextAction:
      | {
          type: 'simulator';
          paymentUuid: string;
          token: string;
          tokenExp: number;
        }
      | {
          type: 'card_transfer';
          paymentUuid: string;
          card: {
            cardNumber: string;
            cardHolderName: string;
            bankName: string;
            instructions: string;
          };
          receiptSubmitted: boolean;
          awaitingAdminReview: boolean;
          receiptFileUuid: string | null;
          receiptFileName: string | null;
          receiptMimeType: string | null;
        }
      | { type: 'none' } = { type: 'none' };

    if (
      payment?.status === PaymentStatus.PENDING &&
      payment.method === PaymentMethod.ONLINE
    ) {
      const creds = await this.ensureSimulatorToken(payment, order.uuid);
      nextAction = {
        type: 'simulator',
        paymentUuid: payment.uuid,
        token: creds.token,
        tokenExp: creds.tokenExp,
      };
    } else if (
      payment?.status === PaymentStatus.PENDING &&
      payment.method === PaymentMethod.BANK_TRANSFER
    ) {
      nextAction = {
        type: 'card_transfer',
        paymentUuid: payment.uuid,
        card: {
          cardNumber: settings.cardTransfer.cardNumber,
          cardHolderName: settings.cardTransfer.cardHolderName,
          bankName: settings.cardTransfer.bankName,
          instructions: settings.cardTransfer.instructions,
        },
        receiptSubmitted: hasReceipt,
        awaitingAdminReview: awaitingCardReview,
        receiptFileUuid: (meta.receiptFileUuid as string) || null,
        receiptFileName: (meta.receiptOriginalName as string) || null,
        receiptMimeType: (meta.receiptMimeType as string) || null,
      };
    }

    return {
      uuid: order.uuid,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: Number(order.subtotal),
      shippingAmount: Number(order.shippingAmount),
      discountAmount: Number(order.discountAmount),
      taxAmount: Number(order.taxAmount),
      total: Number(order.total),
      currency: order.currency,
      note: order.note,
      shippingMethodCode: order.shippingMethodCode,
      shippingMethodTitle: order.shippingMethodTitle,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      metadata: order.metadata,
      items: (order.items || []).map((it: OrderItem) => ({
        uuid: it.uuid,
        productName: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        totalPrice: Number(it.totalPrice),
        attributesSnapshot: it.attributesSnapshot,
      })),
      payment: payment
        ? {
            uuid: payment.uuid,
            method: payment.method,
            status: payment.status,
            amount: Number(payment.amount),
            transactionId: payment.transactionId,
            paidAt: payment.paidAt,
            metadata: payment.metadata,
          }
        : null,
      shipment: shipment
        ? {
            uuid: shipment.uuid,
            status: shipment.status,
            carrier: shipment.carrier,
            trackingNumber: shipment.trackingNumber,
            shippedAt: shipment.shippedAt,
            deliveredAt: shipment.deliveredAt,
          }
        : null,
      nextAction,
      receipt: hasReceipt
        ? {
            fileUuid: String(meta.receiptFileUuid),
            originalName: (meta.receiptOriginalName as string) || null,
            mimeType: (meta.receiptMimeType as string) || null,
            isImage: String(meta.receiptMimeType || '').startsWith('image/'),
            submittedAt: (meta.receiptSubmittedAt as string) || null,
          }
        : null,
      labels: orderLabels({
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: payment?.method ?? null,
        awaitingCardReview,
        hasReceipt,
      }),
      customer: order.user
        ? {
            uuid: (order.user as User).uuid,
            firstName: (order.user as User).firstName,
            lastName: (order.user as User).lastName,
            phone: (order.user as User).phone,
            email: (order.user as User).email,
          }
        : null,
    };
  }

  private orderLines(order: Order) {
    return (order.items || [])
      .filter((i) => i.variantId)
      .map((i) => ({
        variantId: i.variantId!,
        quantity: i.quantity,
      }));
  }

  async completeSimulator(
    user: User,
    paymentUuid: string,
    body: { result: 'success' | 'fail'; token: string; tokenExp: number },
  ) {
    const payment = await this.paymentRepo.findOne({
      where: { uuid: paymentUuid },
      relations: ['order', 'order.items'],
    });
    if (!payment) throw new NotFoundException('پرداخت یافت نشد.');
    const order = payment.order as Order;
    if (order.userId !== user.id) {
      throw new ForbiddenException('دسترسی مجاز نیست.');
    }
    if (payment.method !== PaymentMethod.ONLINE) {
      throw new BadRequestException('این پرداخت مربوط به درگاه آنلاین نیست.');
    }

    // Idempotent success
    if (payment.status === PaymentStatus.PAID) {
      return {
        success: true,
        data: await this.mapOrderDetail(order.uuid, user.id),
      };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('وضعیت پرداخت قابل تغییر نیست.');
    }

    const meta = (payment.metadata || {}) as Record<string, unknown>;
    const bodyToken = String(body.token || '');
    const bodyExp = Number(body.tokenExp || 0);
    const metaToken = String(meta.token || '');
    const metaExp = Number(meta.tokenExp || 0);

    const bodyValid = this.verifySimulatorToken(
      payment.uuid,
      order.uuid,
      bodyExp,
      bodyToken,
      { allowExpired: true },
    );
    const metaValid = this.verifySimulatorToken(
      payment.uuid,
      order.uuid,
      metaExp,
      metaToken,
      { allowExpired: true },
    );
    // Client may hold a stale token after server restart; refresh then accept if ownership ok
    const refreshed = await this.ensureSimulatorToken(payment, order.uuid);
    const matchesIssued =
      bodyToken === refreshed.token ||
      bodyToken === metaToken ||
      bodyValid ||
      metaValid;

    if (!matchesIssued) {
      throw new BadRequestException('توکن درگاه نامعتبر یا منقضی است.');
    }

    if (body.result === 'fail') {
      await this.dataSource.transaction(async (manager) => {
        const p = await manager.getRepository(Payment).findOne({
          where: { id: payment.id },
          lock: { mode: 'pessimistic_write' },
        });
        const o = await manager.getRepository(Order).findOne({
          where: { id: order.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!p || !o) throw new NotFoundException();
        if (p.status !== PaymentStatus.PENDING) return;

        p.status = PaymentStatus.FAILED;
        p.metadata = {
          ...(p.metadata || {}),
          simulatorResult: 'fail',
          failedAt: new Date().toISOString(),
        };
        await manager.getRepository(Payment).save(p);

        const items = await manager.getRepository(OrderItem).find({
          where: { orderId: o.id },
        });
        o.items = items;

        const stockState = (o.metadata as any)?.stockState;
        if (stockState === 'reserved') {
          await this.inventoryService.releaseLines(
            manager,
            this.orderLines(o),
            o.id,
            `آزادسازی رزرو به‌خاطر شکست درگاه — سفارش ${o.orderNumber}`,
          );
          o.metadata = {
            ...(o.metadata || {}),
            stockState: 'released',
          };
        }
        o.paymentStatus = PaymentStatus.FAILED;
        o.status = OrderStatus.CANCELLED;
        await manager.getRepository(Order).save(o);
      });

      return {
        success: true,
        data: await this.mapOrderDetail(order.uuid, user.id),
      };
    }

    await this.markOrderPaid(order.id, payment.id, {
      simulatorResult: 'success',
      provider: 'simulator',
    });

    return {
      success: true,
      data: await this.mapOrderDetail(order.uuid, user.id),
    };
  }

  async submitCardReceipt(user: User, orderUuid: string, fileUuid: string) {
    const order = await this.orderRepo.findOne({
      where: { uuid: orderUuid, userId: user.id },
      relations: ['payments'],
    });
    if (!order) throw new NotFoundException('سفارش یافت نشد.');

    const payment = (order.payments || []).find(
      (p) =>
        p.method === PaymentMethod.BANK_TRANSFER &&
        p.status === PaymentStatus.PENDING,
    );
    if (!payment) {
      throw new BadRequestException('پرداخت کارت‌به‌کارت در انتظار یافت نشد.');
    }

    const file = await this.fileRepo.findOne({ where: { uuid: fileUuid } });
    if (!file) throw new BadRequestException('فایل رسید نامعتبر است.');

    const prevMeta = (payment.metadata || {}) as Record<string, unknown>;
    const prevUuid = prevMeta.receiptFileUuid as string | undefined;
    if (prevUuid && prevUuid !== file.uuid) {
      await this.destroyReceiptFile(prevUuid);
    }

    payment.metadata = {
      ...prevMeta,
      receiptFileUuid: file.uuid,
      receiptOriginalName: file.originalName,
      receiptMimeType: file.mimeType,
      receiptSubmittedAt: new Date().toISOString(),
      awaitingAdminReview: true,
    };
    await this.paymentRepo.save(payment);

    order.metadata = {
      ...(order.metadata || {}),
      cardReceiptSubmitted: true,
    };
    await this.orderRepo.save(order);

    return {
      success: true,
      data: await this.mapOrderDetail(order.uuid, user.id),
    };
  }

  async clearCardReceipt(user: User, orderUuid: string) {
    const order = await this.orderRepo.findOne({
      where: { uuid: orderUuid, userId: user.id },
      relations: ['payments'],
    });
    if (!order) throw new NotFoundException('سفارش یافت نشد.');

    const payment = (order.payments || []).find(
      (p) =>
        p.method === PaymentMethod.BANK_TRANSFER &&
        p.status === PaymentStatus.PENDING,
    );
    if (!payment) {
      throw new BadRequestException('پرداخت کارت‌به‌کارت در انتظار یافت نشد.');
    }

    const prevMeta = (payment.metadata || {}) as Record<string, unknown>;
    await this.destroyReceiptFile(prevMeta.receiptFileUuid as string | undefined);

    payment.metadata = {
      ...prevMeta,
      receiptFileUuid: null,
      receiptOriginalName: null,
      receiptMimeType: null,
      receiptSubmittedAt: null,
      awaitingAdminReview: false,
      receiptClearedAt: new Date().toISOString(),
    };
    await this.paymentRepo.save(payment);

    order.metadata = {
      ...(order.metadata || {}),
      cardReceiptSubmitted: false,
    };
    await this.orderRepo.save(order);

    return {
      success: true,
      data: await this.mapOrderDetail(order.uuid, user.id),
    };
  }

  async markOrderPaid(
    orderId: number,
    paymentId: number,
    extraMeta?: Record<string, unknown>,
    adminUserId?: number | null,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.getRepository(Payment).findOne({
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      const order = await manager.getRepository(Order).findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment || !order) throw new NotFoundException();

      if (payment.status === PaymentStatus.PAID) return;
      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('وضعیت پرداخت برای تایید مناسب نیست.');
      }

      const items = await manager.getRepository(OrderItem).find({
        where: { orderId: order.id },
      });
      order.items = items;

      const stockState = (order.metadata as any)?.stockState;
      if (stockState === 'reserved') {
        await this.inventoryService.commitLines(
          manager,
          this.orderLines(order),
          order.id,
        );
        order.metadata = {
          ...(order.metadata || {}),
          stockState: 'committed',
          paidAt: new Date().toISOString(),
          approvedByAdminId: adminUserId ?? null,
        };
      } else if (stockState !== 'committed') {
        throw new BadRequestException(
          'وضعیت موجودی سفارش برای تایید پرداخت نامعتبر است.',
        );
      }

      payment.status = PaymentStatus.PAID;
      payment.paidAt = new Date();
      payment.metadata = {
        ...(payment.metadata || {}),
        ...(extraMeta || {}),
        awaitingAdminReview: false,
      };
      await manager.getRepository(Payment).save(payment);

      order.paymentStatus = PaymentStatus.PAID;
      order.status = OrderStatus.CONFIRMED;
      await manager.getRepository(Order).save(order);
    });
  }

  async rejectCardPayment(
    orderId: number,
    paymentId: number,
    reason: string,
    adminUserId?: number | null,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.getRepository(Payment).findOne({
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      const order = await manager.getRepository(Order).findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment || !order) throw new NotFoundException();
      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('این پرداخت قابل رد نیست.');
      }

      const items = await manager.getRepository(OrderItem).find({
        where: { orderId: order.id },
      });
      order.items = items;

      const stockState = (order.metadata as any)?.stockState;
      if (stockState === 'reserved') {
        await this.inventoryService.releaseLines(
          manager,
          this.orderLines(order),
          order.id,
          `آزادسازی رزرو — رد کارت‌به‌کارت سفارش ${order.orderNumber}`,
        );
        order.metadata = {
          ...(order.metadata || {}),
          stockState: 'released',
          rejectReason: reason,
          rejectedByAdminId: adminUserId ?? null,
        };
      }

      payment.status = PaymentStatus.FAILED;
      payment.metadata = {
        ...(payment.metadata || {}),
        awaitingAdminReview: false,
        rejectedAt: new Date().toISOString(),
        rejectReason: reason,
      };
      await manager.getRepository(Payment).save(payment);

      order.paymentStatus = PaymentStatus.FAILED;
      order.status = OrderStatus.CANCELLED;
      await manager.getRepository(Order).save(order);
    });
  }
}
