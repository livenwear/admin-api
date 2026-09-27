import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  minEffectiveVariantPrice,
} from 'src/common/pricing/effective-price';
import {
  FileEntity,
  Inventory,
  Product,
  ProductStatus,
} from 'src/entities';
import { Repository } from 'typeorm';
import { TorobProductsRequestDto } from './dto/torob-products.dto';

const PAGE_SIZE = 100;

type TorobProductPayload = {
  page_unique: string;
  page_url: string;
  product_group_id: string;
  title: string;
  subtitle: string | null;
  current_price: number;
  old_price?: number;
  availability: boolean;
  category_name: string | null;
  image_links: string[];
  short_desc: string | null;
  spec: Record<string, string | number>;
  guarantee: string | null;
  date_added: string;
  date_updated: string;
};

@Injectable()
export class TorobService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly config: ConfigService,
  ) {}

  private storefrontBase() {
    return (
      this.config.get<string>('CUSTOMER_WEB_URL') || 'https://livenmode.ir'
    ).replace(/\/+$/, '');
  }

  private apiPublicBase() {
    return (
      this.config.get<string>('API_PUBLIC_URL') ||
      `http://localhost:${this.config.get('PORT') || 3013}/api/v1`
    ).replace(/\/+$/, '');
  }

  private pageUnique(product: Product) {
    return (product.publicId || product.uuid).trim();
  }

  private pageUrl(product: Product) {
    const id = this.pageUnique(product);
    const slug = (product.slug || '').replace(/^\/+|\/+$/g, '');
    const path = slug ? `/products/${id}/${slug}` : `/products/${id}`;
    return `${this.storefrontBase()}${path}`;
  }

  private absoluteMedia(fileUuid: string | null | undefined) {
    if (!fileUuid) return null;
    return `${this.apiPublicBase()}/public/media/${fileUuid}`;
  }

  /** Store prices are Rial; Torob expects Toman integers. */
  private toToman(rial: number | null | undefined): number {
    if (rial == null || !Number.isFinite(rial) || rial <= 0) return 0;
    return Math.max(0, Math.round(rial / 10));
  }

  private toIso(d: Date | string | null | undefined) {
    const date = d instanceof Date ? d : d ? new Date(d) : new Date();
    return date.toISOString();
  }

  private mapProduct(product: Product): TorobProductPayload | null {
    const variants = (product.variants || []).filter(
      (v) => v.isActive !== false,
    );
    const { price, compareAtPrice } = minEffectiveVariantPrice(variants);
    const toman = this.toToman(price);
    const oldToman = this.toToman(compareAtPrice);

    let availableQty = 0;
    for (const v of variants) {
      for (const inv of (v.inventories || []) as Inventory[]) {
        availableQty += Math.max(
          0,
          (inv.quantity || 0) - (inv.reservedQuantity || 0),
        );
      }
    }

    const availability =
      !product.isUnavailable && availableQty > 0 && toman > 0;

    const images = (product.images || [])
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const primary =
      images.find((img) => img.isPrimary) || images[0] || null;
    const ordered = primary
      ? [primary, ...images.filter((i) => i.uuid !== primary.uuid)]
      : images;

    const image_links = ordered
      .map((img) =>
        this.absoluteMedia((img.file as FileEntity | undefined)?.uuid),
      )
      .filter((u): u is string => Boolean(u))
      .slice(0, 10);

    if (!image_links.length) {
      // Torob requires image_links; skip incomplete rows from list feeds
      return null;
    }

    const categories = (product.productCategories || [])
      .map((pc: any) => pc.category)
      .filter(Boolean);
    const category_name = categories[0]?.title
      ? String(categories[0].title).slice(0, 200)
      : null;

    const spec: Record<string, string | number> = {};
    for (const s of product.specifications || []) {
      if (s?.label && s?.value != null) {
        spec[String(s.label).slice(0, 100)] = String(s.value).slice(0, 200);
      }
    }
    // Include default variant attributes as specs when present
    const def =
      variants.find((v) => v.isDefault) || variants[0] || null;
    if (def) {
      for (const vav of def.variantAttributeValues || []) {
        const name = vav.attributeValue?.attribute?.name;
        const value = vav.attributeValue?.value;
        if (name && value != null && spec[name] == null) {
          spec[String(name).slice(0, 100)] = String(value).slice(0, 200);
        }
      }
    }

    const payload: TorobProductPayload = {
      page_unique: this.pageUnique(product).slice(0, 200),
      page_url: this.pageUrl(product).slice(0, 1500),
      product_group_id: this.pageUnique(product).slice(0, 200),
      title: String(product.name || '').slice(0, 500),
      subtitle: product.brand?.name
        ? String(product.brand.name).slice(0, 500)
        : null,
      current_price: availability ? toman : 0,
      availability,
      category_name,
      image_links,
      short_desc: product.shortDescription
        ? String(product.shortDescription).slice(0, 500)
        : null,
      spec,
      guarantee: null,
      date_added: this.toIso(product.createdAt),
      date_updated: this.toIso(product.updatedAt),
    };

    if (oldToman > toman && toman > 0) {
      payload.old_price = oldToman;
    }

    return payload;
  }

  private baseQb() {
    return this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.images', 'images')
      .leftJoinAndSelect('images.file', 'imageFile')
      .leftJoinAndSelect('p.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .leftJoinAndSelect('variants.inventories', 'inventories')
      .leftJoinAndSelect('variants.variantAttributeValues', 'vav')
      .leftJoinAndSelect('vav.attributeValue', 'attrValue')
      .leftJoinAndSelect('attrValue.attribute', 'attribute')
      .leftJoinAndSelect('p.productCategories', 'pc')
      .leftJoinAndSelect('pc.category', 'category')
      .leftJoinAndSelect('p.specifications', 'specifications')
      .where('p.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('p.isListedOnTorob = true')
      .andWhere('p.deletedAt IS NULL');
  }

  private applySort(
    qb: ReturnType<TorobService['baseQb']>,
    sort: string,
  ) {
    if (sort === 'date_updated_desc') {
      qb.orderBy('p.updatedAt', 'DESC').addOrderBy('p.id', 'DESC');
    } else if (sort === 'product_id_desc') {
      qb.orderBy('p.id', 'DESC');
    } else {
      // date_added_desc (required)
      qb.orderBy('p.createdAt', 'DESC').addOrderBy('p.id', 'DESC');
    }
  }

  async handleProductsRequest(body: TorobProductsRequestDto) {
    const hasUrls = Array.isArray(body.page_urls) && body.page_urls.length > 0;
    const hasUniques =
      Array.isArray(body.page_uniques) && body.page_uniques.length > 0;
    const hasPage = body.page != null;
    const hasCursor = body.cursor != null && String(body.cursor).length > 0;
    const hasSort = typeof body.sort === 'string' && body.sort.length > 0;

    if (hasUrls) {
      if (hasUniques || hasPage || hasCursor) {
        throw new BadRequestException({
          error: 'use only one request mode at a time',
        });
      }
      return this.byUrls(body.page_urls!);
    }

    if (hasUniques) {
      if (hasPage || hasCursor) {
        throw new BadRequestException({
          error: 'use only one request mode at a time',
        });
      }
      return this.byUniques(body.page_uniques!);
    }

    if (!hasSort) {
      throw new BadRequestException({ error: 'sort parameter is not provided' });
    }

    const allowed = [
      'date_added_desc',
      'date_updated_desc',
      'product_id_desc',
    ];
    if (!allowed.includes(body.sort!)) {
      throw new BadRequestException({ error: 'invalid sort parameter' });
    }

    // Cursor pagination: {"sort":"product_id_desc"} or + cursor
    if (!hasPage && body.sort === 'product_id_desc') {
      return this.byCursor(hasCursor ? String(body.cursor) : null);
    }

    if (!hasPage) {
      throw new BadRequestException({ error: 'page parameter is not provided' });
    }

    if (hasCursor) {
      throw new BadRequestException({
        error: 'do not send cursor with page pagination',
      });
    }

    return this.byPage(body.page!, body.sort!);
  }

  private wrap(
    products: TorobProductPayload[],
    meta: {
      current_page: number;
      total: number | null;
      max_pages: number | null;
      next_cursor?: string | null;
    },
  ) {
    return {
      api_version: 'torob_api_v3',
      current_page: meta.current_page,
      total: meta.total,
      max_pages: meta.max_pages,
      next_cursor: meta.next_cursor ?? null,
      products,
    };
  }

  private async byUrls(urls: string[]) {
    const qb = this.baseQb();
    const all = await qb.getMany();
    const wanted = new Set(urls.map((u) => u.trim()));
    const mapped = all
      .map((p) => this.mapProduct(p))
      .filter((p): p is TorobProductPayload => Boolean(p))
      .filter((p) => wanted.has(p.page_url));

    return this.wrap(mapped, {
      current_page: 1,
      total: mapped.length,
      max_pages: 1,
    });
  }

  private async byUniques(uniques: string[]) {
    const keys = uniques.map((u) => u.trim()).filter(Boolean);
    if (!keys.length) {
      return this.wrap([], { current_page: 1, total: 0, max_pages: 1 });
    }

    const qb = this.baseQb().andWhere(
      '(p.publicId IN (:...keys) OR p.uuid IN (:...keys))',
      { keys },
    );
    const rows = await qb.getMany();
    const mapped = rows
      .map((p) => this.mapProduct(p))
      .filter((p): p is TorobProductPayload => Boolean(p));

    return this.wrap(mapped, {
      current_page: 1,
      total: mapped.length,
      max_pages: 1,
    });
  }

  private async byPage(page: number, sort: string) {
    const qb = this.baseQb();
    this.applySort(qb, sort);

    const total = await qb.clone().getCount();
    const max_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.max(1, page);

    const rows = await qb
      .skip((safePage - 1) * PAGE_SIZE)
      .take(PAGE_SIZE)
      .getMany();

    const mapped = rows
      .map((p) => this.mapProduct(p))
      .filter((p): p is TorobProductPayload => Boolean(p));

    return this.wrap(mapped, {
      current_page: safePage,
      total,
      max_pages,
    });
  }

  private async byCursor(cursor: string | null) {
    const qb = this.baseQb();
    qb.orderBy('p.id', 'DESC');

    if (cursor) {
      const id = Number(cursor);
      if (!Number.isFinite(id)) {
        throw new BadRequestException({ error: 'invalid cursor' });
      }
      qb.andWhere('p.id < :cursorId', { cursorId: id });
    }

    const rows = await qb.take(PAGE_SIZE).getMany();
    const mapped = rows
      .map((p) => this.mapProduct(p))
      .filter((p): p is TorobProductPayload => Boolean(p));

    const next_cursor =
      rows.length === PAGE_SIZE ? String(rows[rows.length - 1].id) : null;

    return this.wrap(mapped, {
      current_page: 1,
      total: null,
      max_pages: null,
      next_cursor,
    });
  }
}
