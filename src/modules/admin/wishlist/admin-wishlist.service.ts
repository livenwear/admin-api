import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Product,
  ProductImage,
  WishlistItem,
} from 'src/entities';
import { ProductStatus } from 'src/entities/enums';
import { Repository } from 'typeorm';

@Injectable()
export class AdminWishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly itemRepo: Repository<WishlistItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  private mediaPath(fileUuid: string | null | undefined) {
    if (!fileUuid) return null;
    return `/public/media/${fileUuid}`;
  }

  private mapProductBrief(product: Product) {
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

    return {
      uuid: product.uuid,
      publicId: product.publicId,
      name: product.name,
      slug: product.slug,
      imageUrl: this.mediaPath(file?.uuid ?? null),
      fileUuid: file?.uuid ?? null,
      price,
      compareAtPrice,
      status: product.status,
      isAmazing: product.isAmazing,
      isFeatured: product.isFeatured,
    };
  }

  async getPopular(limit = 40) {
    const take = Math.min(Math.max(limit, 1), 100);

    const ranked = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .innerJoin('item.wishlist', 'wishlist')
      .select('product.id', 'productId')
      .addSelect('COUNT(DISTINCT wishlist.user_id)', 'favoritesCount')
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .groupBy('product.id')
      .orderBy('COUNT(DISTINCT wishlist.user_id)', 'DESC')
      .addOrderBy('MAX(item.createdAt)', 'DESC')
      .limit(take)
      .getRawMany<{ productId: string; favoritesCount: string }>();

    if (!ranked.length) {
      return {
        success: true,
        data: {
          totalFavorites: 0,
          products: [],
        },
      };
    }

    const productIds = ranked.map((r) => Number(r.productId));
    const products = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.images', 'images')
      .leftJoinAndSelect('images.file', 'file')
      .leftJoinAndSelect('p.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .where('p.id IN (:...ids)', { ids: productIds })
      .getMany();

    const productMap = new Map(products.map((p) => [p.id, p]));

    const userRows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.wishlist', 'wishlist')
      .innerJoin('wishlist.user', 'user')
      .select('item.product_id', 'productId')
      .addSelect('user.uuid', 'userUuid')
      .addSelect('user.firstName', 'firstName')
      .addSelect('user.lastName', 'lastName')
      .addSelect('user.phone', 'phone')
      .addSelect('user.email', 'email')
      .addSelect('MAX(item.createdAt)', 'favoritedAt')
      .where('item.product_id IN (:...ids)', { ids: productIds })
      .groupBy('item.product_id')
      .addGroupBy('user.id')
      .addGroupBy('user.uuid')
      .addGroupBy('user.firstName')
      .addGroupBy('user.lastName')
      .addGroupBy('user.phone')
      .addGroupBy('user.email')
      .orderBy('MAX(item.createdAt)', 'DESC')
      .getRawMany<{
        productId: string;
        userUuid: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        email: string | null;
        favoritedAt: string;
      }>();

    const usersByProduct = new Map<
      number,
      Array<{
        uuid: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        email: string | null;
        favoritedAt: string;
      }>
    >();

    for (const row of userRows) {
      const pid = Number(row.productId);
      const list = usersByProduct.get(pid) || [];
      list.push({
        uuid: row.userUuid,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        email: row.email,
        favoritedAt: row.favoritedAt,
      });
      usersByProduct.set(pid, list);
    }

    const totalFavorites = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .getCount();

    return {
      success: true,
      data: {
        totalFavorites,
        products: ranked
          .map((row) => {
            const product = productMap.get(Number(row.productId));
            if (!product) return null;
            const users = usersByProduct.get(product.id) || [];
            return {
              favoritesCount: Number(row.favoritesCount),
              product: this.mapProductBrief(product),
              users,
            };
          })
          .filter(Boolean),
      },
    };
  }
}
