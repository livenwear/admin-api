import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Cart,
  CartItem,
  Product,
  ProductImage,
  ProductRelated,
  ProductVariant,
  User,
} from 'src/entities';
import { ProductStatus } from 'src/entities/enums';
import { In, IsNull, Repository } from 'typeorm';
import { CartAddDto, CartSetQtyDto } from './dto/cart.dto';

const GUEST_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CustomerCartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly itemRepo: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(ProductRelated)
    private readonly relatedRepo: Repository<ProductRelated>,
  ) {}

  private mediaPath(fileUuid: string | null | undefined) {
    if (!fileUuid) return null;
    return `/public/media/${fileUuid}`;
  }

  private assertGuestToken(token?: string | null) {
    if (!token || !GUEST_TOKEN_RE.test(token.trim())) {
      throw new BadRequestException(
        'توکن سبد مهمان نامعتبر است — هدر X-Guest-Cart-Token را بفرستید.',
      );
    }
    return token.trim();
  }

  private async getOrCreateCart(user: User | null, guestToken?: string | null) {
    if (user) {
      let cart = await this.cartRepo.findOne({ where: { userId: user.id } });
      if (!cart) {
        cart = await this.cartRepo.save(
          this.cartRepo.create({
            userId: user.id,
            guestToken: null,
          }),
        );
      }
      return cart;
    }
    const token = this.assertGuestToken(guestToken);
    let cart = await this.cartRepo.findOne({
      where: { guestToken: token, userId: IsNull() },
    });
    if (!cart) {
      cart = await this.cartRepo.save(
        this.cartRepo.create({
          userId: null,
          guestToken: token,
        }),
      );
    }
    return cart;
  }

  private variantPrice(variant: ProductVariant) {
    const prices = (variant as any).prices || [];
    const active =
      prices.find((p: { isActive?: boolean }) => p.isActive) || prices[0];
    if (!active) {
      return { unitPrice: 0, compareAtPrice: null as number | null };
    }
    return {
      unitPrice: Number(active.amount) || 0,
      compareAtPrice: active.compareAtAmount
        ? Number(active.compareAtAmount)
        : null,
    };
  }

  private buildBadges(product: Product) {
    const badges: Array<{
      key: string;
      label: string;
      tone: 'amazing' | 'featured' | 'new' | 'custom' | 'unavailable';
      colorCode: string | null;
    }> = [];
    if (product.isAmazing) {
      badges.push({
        key: 'amazing',
        label: 'شگفت‌انگیز',
        tone: 'amazing',
        colorCode: '#E11D48',
      });
    }
    if (product.isUnavailable) {
      badges.push({
        key: 'unavailable',
        label: 'ناموجود',
        tone: 'unavailable',
        colorCode: '#64748B',
      });
    }
    if (product.isFeatured) {
      badges.push({
        key: 'featured',
        label: 'پرفروش',
        tone: 'featured',
        colorCode: '#C2410C',
      });
    }
    return badges;
  }

  private mapProductCard(product: Product) {
    const images = ((product as any)?.images || []) as ProductImage[];
    const sorted = images
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const primary = sorted.find((img) => img.isPrimary) || sorted[0];
    const file = primary?.file as { uuid?: string } | undefined;

    let price: number | null = null;
    let compareAtPrice: number | null = null;
    for (const v of (product as any)?.variants || []) {
      const { unitPrice, compareAtPrice: cmp } = this.variantPrice(v);
      if (!unitPrice) continue;
      if (price === null || unitPrice < price) {
        price = unitPrice;
        compareAtPrice = cmp;
      }
    }

    let discountPercent: number | null = null;
    if (price != null && compareAtPrice != null && compareAtPrice > price) {
      discountPercent = Math.round(
        ((compareAtPrice - price) / compareAtPrice) * 100,
      );
    }

    return {
      uuid: product.uuid,
      publicId: product.publicId,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      imageUrl: this.mediaPath(file?.uuid ?? null),
      fileUuid: file?.uuid ?? null,
      price,
      compareAtPrice,
      discountPercent,
      ratingAvg: Number(product.ratingAvg || 0),
      ratingCount: product.ratingCount || 0,
      isAmazing: product.isAmazing,
      isFeatured: product.isFeatured,
      isUnavailable: Boolean(product.isUnavailable),
      brandName: (product as any).brand?.name ?? null,
      badges: this.buildBadges(product),
      sizes: [] as string[],
      categories: ((product as any).productCategories || [])
        .map((pc: any) => pc.category)
        .filter(Boolean)
        .map((c: any) => ({
          uuid: c.uuid,
          title: c.title,
          slug: c.slug,
        })),
    };
  }

  private mapLine(item: CartItem) {
    const variant = item.variant as ProductVariant;
    const product = (variant as any)?.product as Product | undefined;
    const { unitPrice, compareAtPrice } = this.variantPrice(variant);
    const qty = item.quantity;
    const lineTotal = unitPrice * qty;
    const lineCompare =
      compareAtPrice != null && compareAtPrice > unitPrice
        ? compareAtPrice * qty
        : null;
    const savings =
      lineCompare != null ? Math.max(0, lineCompare - lineTotal) : 0;

    const attrs: Array<{
      name: string;
      slug: string;
      value: string;
      colorCode: string | null;
    }> = [];
    for (const vav of (variant as any).variantAttributeValues || []) {
      const av = vav.attributeValue;
      if (!av) continue;
      attrs.push({
        name: av.attribute?.name || '',
        slug: av.attribute?.slug || '',
        value: String(av.value || ''),
        colorCode: av.colorCode || null,
      });
    }

    return {
      id: item.id,
      quantity: qty,
      unitPrice,
      compareAtPrice,
      lineTotal,
      lineCompareTotal: lineCompare,
      savings,
      createdAt: item.createdAt,
      updatedAt: (item as any).updatedAt || item.createdAt,
      variant: {
        uuid: variant.uuid,
        title: variant.title,
        sku: variant.sku,
        attributes: attrs,
      },
      product: product ? this.mapProductCard(product) : null,
    };
  }

  private async loadItems(cartId: number) {
    return this.itemRepo
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.variant', 'variant')
      .innerJoinAndSelect('variant.product', 'product')
      .leftJoinAndSelect('variant.prices', 'prices')
      .leftJoinAndSelect('variant.variantAttributeValues', 'vav')
      .leftJoinAndSelect('vav.attributeValue', 'av')
      .leftJoinAndSelect('av.attribute', 'attr')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('images.file', 'file')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.productCategories', 'pc')
      .leftJoinAndSelect('pc.category', 'category')
      .where('item.cartId = :cartId', { cartId })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('variant.isActive = true')
      .orderBy('item.createdAt', 'DESC')
      .getMany();
  }

  private summarize(lines: ReturnType<CustomerCartService['mapLine']>[]) {
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const compareTotal = lines.reduce(
      (s, l) => s + (l.lineCompareTotal ?? l.lineTotal),
      0,
    );
    const savings = Math.max(0, compareTotal - subtotal);
    return {
      lineCount: lines.length,
      itemCount,
      subtotal,
      compareTotal,
      savings,
      currency: 'IRR',
    };
  }

  private async buildPayload(cart: Cart) {
    const raw = await this.loadItems(cart.id);
    const items = raw.map((i) => this.mapLine(i));
    const totals = this.summarize(items);
    const unavailableItems = items.filter((i) => i.product?.isUnavailable);
    const canCheckout = unavailableItems.length === 0 && items.length > 0;
    const products = raw
      .map((i) => (i.variant as any)?.product as Product)
      .filter(Boolean);
    const recommendations = await this.loadRecommendations(products, 20);
    return {
      success: true,
      data: {
        cartUuid: cart.uuid,
        items,
        totals: {
          ...totals,
          canCheckout,
          hasUnavailableItems: unavailableItems.length > 0,
          unavailableCount: unavailableItems.length,
          checkoutBlockedReason: unavailableItems.length
            ? `${unavailableItems.length} کالا در سبد ناموجود است و فعلاً قابل پرداخت نیست.`
            : null,
        },
        preview: items.slice(0, 3),
        recommendations,
      },
    };
  }

  private async loadRecommendations(sourceProducts: Product[], limit = 20) {
    if (!sourceProducts.length) {
      const fillers = await this.productRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.images', 'images')
        .leftJoinAndSelect('images.file', 'file')
        .leftJoinAndSelect('p.variants', 'variants')
        .leftJoinAndSelect('variants.prices', 'prices')
        .where('p.status = :status', { status: ProductStatus.ACTIVE })
        .orderBy('p.isFeatured', 'DESC')
        .addOrderBy('p.viewCount', 'DESC')
        .take(limit)
        .getMany();
      return fillers.map((p) => this.mapProductCard(p));
    }

    const excludeIds = sourceProducts.map((p) => p.id);
    const relatedIds: number[] = [];
    const links = await this.relatedRepo.find({
      where: { productId: In(excludeIds) },
      order: { id: 'ASC' },
    });
    for (const link of links) {
      if (
        link.relatedProductId &&
        !excludeIds.includes(link.relatedProductId) &&
        !relatedIds.includes(link.relatedProductId)
      ) {
        relatedIds.push(link.relatedProductId);
      }
    }

    const collected: Product[] = [];
    if (relatedIds.length) {
      const relatedProducts = await this.productRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.images', 'images')
        .leftJoinAndSelect('images.file', 'file')
        .leftJoinAndSelect('p.variants', 'variants')
        .leftJoinAndSelect('variants.prices', 'prices')
        .where('p.status = :status', { status: ProductStatus.ACTIVE })
        .andWhere('p.id IN (:...ids)', { ids: relatedIds.slice(0, limit) })
        .getMany();
      const order = new Map(relatedIds.map((id, i) => [id, i]));
      relatedProducts.sort(
        (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
      );
      collected.push(...relatedProducts);
    }

    if (collected.length < limit) {
      const categoryIds = new Set<number>();
      for (const p of sourceProducts) {
        for (const pc of (p as any).productCategories || []) {
          const id = pc.category?.id || pc.categoryId;
          if (id) categoryIds.add(Number(id));
        }
      }
      const exclude = [...excludeIds, ...collected.map((p) => p.id)];
      const qb = this.productRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.images', 'images')
        .leftJoinAndSelect('images.file', 'file')
        .leftJoinAndSelect('p.variants', 'variants')
        .leftJoinAndSelect('variants.prices', 'prices')
        .leftJoin('p.productCategories', 'pc')
        .leftJoin('pc.category', 'category')
        .where('p.status = :status', { status: ProductStatus.ACTIVE })
        .andWhere(
          exclude.length ? 'p.id NOT IN (:...exclude)' : '1=1',
          exclude.length ? { exclude } : {},
        )
        .orderBy('p.isFeatured', 'DESC')
        .addOrderBy('p.viewCount', 'DESC')
        .take(limit - collected.length);
      if (categoryIds.size) {
        qb.andWhere('category.id IN (:...categoryIds)', {
          categoryIds: [...categoryIds],
        });
      }
      collected.push(...(await qb.getMany()));
    }

    return collected.map((p) => this.mapProductCard(p));
  }

  async getCart(user: User | null, guestToken?: string | null) {
    const cart = await this.getOrCreateCart(user, guestToken);
    return this.buildPayload(cart);
  }

  async summary(user: User | null, guestToken?: string | null) {
    const cart = await this.getOrCreateCart(user, guestToken);
    const raw = await this.loadItems(cart.id);
    const items = raw.map((i) => this.mapLine(i));
    const totals = this.summarize(items);
    return {
      success: true,
      data: {
        ...totals,
        preview: items.slice(0, 3),
      },
    };
  }

  async add(
    user: User | null,
    guestToken: string | null | undefined,
    dto: CartAddDto,
  ) {
    const cart = await this.getOrCreateCart(user, guestToken);

    let variant: ProductVariant | null = null;
    if (dto.variantUuid) {
      variant = await this.variantRepo.findOne({
        where: { uuid: dto.variantUuid, isActive: true },
        relations: ['product'],
      });
    } else if (dto.productUuid) {
      const product = await this.productRepo.findOne({
        where: { uuid: dto.productUuid, status: ProductStatus.ACTIVE },
        relations: ['variants'],
      });
      if (!product) throw new NotFoundException('محصول یافت نشد.');
      const variants = ((product as any).variants || []) as ProductVariant[];
      variant =
        variants.find((v) => v.isActive && v.isDefault) ||
        variants.find((v) => v.isActive) ||
        null;
      if (variant) {
        variant = await this.variantRepo.findOne({
          where: { id: variant.id },
          relations: ['product'],
        });
      }
    } else {
      throw new BadRequestException('variantUuid یا productUuid لازم است.');
    }

    if (!variant || (variant as any).product?.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('تنوع محصول یافت نشد.');
    }

    const qty = dto.quantity ?? 1;
    let item = await this.itemRepo.findOne({
      where: { cartId: cart.id, variantId: variant.id },
    });
    if (item) {
      item.quantity = Math.min(99, item.quantity + qty);
      await this.itemRepo.save(item);
    } else {
      item = await this.itemRepo.save(
        this.itemRepo.create({
          cartId: cart.id,
          variantId: variant.id,
          quantity: Math.min(99, qty),
        }),
      );
    }

    await this.touchCart(cart);
    const payload = await this.buildPayload(cart);
    return {
      success: true,
      data: {
        ...payload.data,
        addedVariantUuid: variant.uuid,
      },
    };
  }

  async setQuantity(
    user: User | null,
    guestToken: string | null | undefined,
    variantUuid: string,
    dto: CartSetQtyDto,
  ) {
    const cart = await this.getOrCreateCart(user, guestToken);
    const variant = await this.variantRepo.findOne({
      where: { uuid: variantUuid },
    });
    if (!variant) throw new NotFoundException('تنوع محصول یافت نشد.');

    const item = await this.itemRepo.findOne({
      where: { cartId: cart.id, variantId: variant.id },
    });
    if (!item) throw new NotFoundException('این کالا در سبد نیست.');

    if (dto.quantity <= 0) {
      await this.itemRepo.remove(item);
    } else {
      item.quantity = Math.min(99, dto.quantity);
      await this.itemRepo.save(item);
    }

    await this.touchCart(cart);
    return this.buildPayload(cart);
  }

  async remove(
    user: User | null,
    guestToken: string | null | undefined,
    variantUuid: string,
  ) {
    return this.setQuantity(user, guestToken, variantUuid, { quantity: 0 });
  }

  async clear(user: User | null, guestToken?: string | null) {
    const cart = await this.getOrCreateCart(user, guestToken);
    await this.itemRepo.delete({ cartId: cart.id });
    await this.touchCart(cart);
    return this.buildPayload(cart);
  }

  private async touchCart(cart: Cart) {
    cart.updatedAt = new Date();
    await this.cartRepo.save(cart);
  }

  /** Merge guest cart into user cart after login. */
  async mergeGuestIntoUser(user: User, guestToken?: string | null) {
    if (!guestToken || !GUEST_TOKEN_RE.test(guestToken.trim())) {
      return this.getCart(user, null);
    }
    const token = guestToken.trim();
    const guestCart = await this.cartRepo.findOne({
      where: { guestToken: token, userId: IsNull() },
    });
    const userCart = await this.getOrCreateCart(user, null);
    if (!guestCart || guestCart.id === userCart.id) {
      return this.buildPayload(userCart);
    }

    const guestItems = await this.itemRepo.find({
      where: { cartId: guestCart.id },
    });
    for (const gi of guestItems) {
      const existing = await this.itemRepo.findOne({
        where: { cartId: userCart.id, variantId: gi.variantId },
      });
      if (existing) {
        existing.quantity = Math.min(99, existing.quantity + gi.quantity);
        await this.itemRepo.save(existing);
      } else {
        await this.itemRepo.save(
          this.itemRepo.create({
            cartId: userCart.id,
            variantId: gi.variantId,
            quantity: gi.quantity,
          }),
        );
      }
    }
    await this.itemRepo.delete({ cartId: guestCart.id });
    await this.cartRepo.softRemove(guestCart);
    await this.touchCart(userCart);
    return this.buildPayload(userCart);
  }
}
