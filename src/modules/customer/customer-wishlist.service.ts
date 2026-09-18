import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Product,
  ProductImage,
  ProductRelated,
  ProductVariant,
  User,
  Wishlist,
  WishlistItem,
} from 'src/entities';
import { ProductStatus } from 'src/entities/enums';
import { In, IsNull, Repository } from 'typeorm';
import { WishlistAddDto, WishlistToggleDto } from './dto/wishlist.dto';

@Injectable()
export class CustomerWishlistService {
  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,
    @InjectRepository(WishlistItem)
    private readonly itemRepo: Repository<WishlistItem>,
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

  private async getOrCreateWishlist(user: User): Promise<Wishlist> {
    let wishlist = await this.wishlistRepo.findOne({
      where: { userId: user.id, name: 'default' },
    });
    if (!wishlist) {
      wishlist = await this.wishlistRepo.save(
        this.wishlistRepo.create({
          userId: user.id,
          name: 'default',
        }),
      );
    }
    return wishlist;
  }

  private async resolveProduct(productUuid: string) {
    const product = await this.productRepo.findOne({
      where: { uuid: productUuid, status: ProductStatus.ACTIVE },
    });
    if (!product) throw new NotFoundException('محصول یافت نشد.');
    return product;
  }

  private async resolveVariant(
    productId: number,
    variantUuid?: string | null,
  ): Promise<number | null> {
    if (!variantUuid) return null;
    const variant = await this.variantRepo.findOne({
      where: { uuid: variantUuid, productId },
    });
    if (!variant) throw new NotFoundException('تنوع محصول یافت نشد.');
    return variant.id;
  }

  private async findItem(
    wishlistId: number,
    productId: number,
    variantId: number | null,
  ) {
    if (variantId == null) {
      return this.itemRepo.findOne({
        where: {
          wishlistId,
          productId,
          variantId: IsNull(),
        },
      });
    }
    return this.itemRepo.findOne({
      where: { wishlistId, productId, variantId },
    });
  }

  private async countItems(wishlistId: number) {
    return this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .where('item.wishlistId = :wid', { wid: wishlistId })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .getCount();
  }

  private buildBadges(product: Product) {
    const badges: Array<{
      key: string;
      label: string;
      tone: 'amazing' | 'featured' | 'new' | 'custom';
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

  private extractSizes(product: Product): string[] {
    const sizes = new Set<string>();
    for (const v of (product as any).variants || []) {
      for (const vav of v.variantAttributeValues || []) {
        const attr = vav.attributeValue?.attribute;
        const value = vav.attributeValue?.value;
        if (!value) continue;
        const name = `${attr?.name || ''} ${attr?.slug || ''}`.toLowerCase();
        if (
          name.includes('سایز') ||
          name.includes('size') ||
          attr?.slug === 'size'
        ) {
          sizes.add(String(value).trim());
        }
      }
    }
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
    return Array.from(sizes).sort((a, b) => {
      const ia = order.indexOf(a.toUpperCase());
      const ib = order.indexOf(b.toUpperCase());
      if (ia === -1 && ib === -1) return a.localeCompare(b, 'fa');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
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
      const active =
        (v.prices || []).find((p: { isActive?: boolean }) => p.isActive) ||
        v.prices?.[0];
      if (!active) continue;
      const amount = Number(active.amount);
      if (price === null || amount < price) {
        price = amount;
        compareAtPrice = active.compareAtAmount
          ? Number(active.compareAtAmount)
          : null;
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
      brandName: (product as any).brand?.name ?? null,
      badges: this.buildBadges(product),
      sizes: this.extractSizes(product),
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

  private mapItem(item: WishlistItem) {
    const product = item.product as Product | undefined;
    return {
      id: item.id,
      createdAt: item.createdAt,
      product: product ? this.mapProductCard(product) : null,
      variant: item.variant
        ? {
            uuid: (item.variant as ProductVariant).uuid,
            title: (item.variant as ProductVariant).title,
            sku: (item.variant as ProductVariant).sku,
          }
        : null,
    };
  }

  private async loadRecommendations(
    sourceProducts: Product[],
    limit = 12,
  ) {
    if (!sourceProducts.length) return [];

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
        .addOrderBy('p.createdAt', 'DESC')
        .take(limit - collected.length);

      if (categoryIds.size) {
        qb.andWhere('category.id IN (:...categoryIds)', {
          categoryIds: [...categoryIds],
        });
      }

      const fillers = await qb.getMany();
      collected.push(...fillers);
    }

    return collected.map((p) => this.mapProductCard(p));
  }

  async list(user: User) {
    const wishlist = await this.getOrCreateWishlist(user);
    const items = await this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('images.file', 'file')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .leftJoinAndSelect('variants.variantAttributeValues', 'vav')
      .leftJoinAndSelect('vav.attributeValue', 'attrValue')
      .leftJoinAndSelect('attrValue.attribute', 'attribute')
      .leftJoinAndSelect('product.productCategories', 'pc')
      .leftJoinAndSelect('pc.category', 'category')
      .leftJoinAndSelect('item.variant', 'variant')
      .where('item.wishlistId = :wid', { wid: wishlist.id })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .orderBy('item.createdAt', 'DESC')
      .getMany();

    const sourceProducts = items
      .map((i) => i.product as Product | undefined)
      .filter((p): p is Product => Boolean(p));

    const recommendations = await this.loadRecommendations(sourceProducts, 12);

    return {
      success: true,
      data: {
        count: items.length,
        items: items.map((item) => this.mapItem(item)),
        recommendations,
      },
    };
  }

  async summary(user: User) {
    const wishlist = await this.getOrCreateWishlist(user);
    const items = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('images.file', 'file')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .where('item.wishlistId = :wid', { wid: wishlist.id })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .orderBy('item.createdAt', 'DESC')
      .getMany();

    const productUuids = items
      .map((i) => (i.product as Product | undefined)?.uuid)
      .filter((u): u is string => Boolean(u));

    const preview = items.slice(0, 3).map((item) => {
      const product = item.product as Product;
      const card = this.mapProductCard(product);
      return {
        createdAt: item.createdAt,
        product: card,
      };
    });

    return {
      success: true,
      data: {
        count: productUuids.length,
        productUuids,
        preview,
      },
    };
  }

  async add(user: User, dto: WishlistAddDto) {
    const wishlist = await this.getOrCreateWishlist(user);
    const product = await this.resolveProduct(dto.productUuid);
    const variantId = await this.resolveVariant(product.id, dto.variantUuid);

    const existing = await this.findItem(wishlist.id, product.id, variantId);
    if (!existing) {
      await this.itemRepo.save(
        this.itemRepo.create({
          wishlistId: wishlist.id,
          productId: product.id,
          variantId,
        }),
      );
    }

    const count = await this.countItems(wishlist.id);
    return {
      success: true,
      data: {
        inWishlist: true,
        count,
        productUuid: product.uuid,
      },
    };
  }

  async remove(user: User, productUuid: string) {
    const wishlist = await this.getOrCreateWishlist(user);
    const product = await this.productRepo.findOne({
      where: { uuid: productUuid },
    });
    if (!product) throw new NotFoundException('محصول یافت نشد.');

    await this.itemRepo.delete({
      wishlistId: wishlist.id,
      productId: product.id,
    });

    const count = await this.countItems(wishlist.id);
    return {
      success: true,
      data: {
        inWishlist: false,
        count,
        productUuid: product.uuid,
      },
    };
  }

  async toggle(user: User, dto: WishlistToggleDto) {
    const wishlist = await this.getOrCreateWishlist(user);
    const product = await this.resolveProduct(dto.productUuid);
    const variantId = await this.resolveVariant(product.id, dto.variantUuid);

    const existing = await this.findItem(wishlist.id, product.id, variantId);
    let inWishlist: boolean;

    if (existing) {
      await this.itemRepo.remove(existing);
      inWishlist = false;
    } else {
      await this.itemRepo.save(
        this.itemRepo.create({
          wishlistId: wishlist.id,
          productId: product.id,
          variantId,
        }),
      );
      inWishlist = true;
    }

    const count = await this.countItems(wishlist.id);
    return {
      success: true,
      data: {
        inWishlist,
        count,
        productUuid: product.uuid,
        added: inWishlist,
      },
    };
  }

  /** Admin helper: wishlist for a given user id */
  async listForUserId(userId: number) {
    const wishlist = await this.wishlistRepo.findOne({
      where: { userId, name: 'default' },
    });
    if (!wishlist) {
      return { count: 0, items: [] as ReturnType<typeof this.mapItem>[] };
    }

    const items = await this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('images.file', 'file')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .leftJoinAndSelect('item.variant', 'variant')
      .where('item.wishlistId = :wid', { wid: wishlist.id })
      .orderBy('item.createdAt', 'DESC')
      .getMany();

    return {
      count: items.length,
      items: items.map((item) => this.mapItem(item)),
    };
  }
}
