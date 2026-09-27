import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { minEffectiveVariantPrice } from 'src/common/pricing/effective-price';
import {
  FileEntity,
  Inventory,
  Product,
  ProductStatus,
} from 'src/entities';
import { Repository } from 'typeorm';
import { EmallsAuthService } from './emalls-auth.service';
import { EmallsProductsRequestDto } from './dto/emalls-products.dto';

type EmallsProductRow = {
  title: string;
  subtitle: string;
  parent_id: number | string;
  page_unique: string;
  current_price: number;
  old_price: number | string;
  availability: 'instock' | 'outofstock';
  category_name: string;
  image_links: string[];
  image_link: string | null;
  page_url: string;
  short_desc: string;
  spec: Array<Record<string, string>>;
  date_added: string | null;
  date_updated: string | null;
  product_type: string;
  registry: string;
  guarantee: string;
};

@Injectable()
export class EmallsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly config: ConfigService,
    private readonly auth: EmallsAuthService,
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

  /** Store prices are Rial; Emalls Iranian shops typically use Toman. */
  private toToman(rial: number | null | undefined): number {
    if (rial == null || !Number.isFinite(rial) || rial <= 0) return 0;
    return Math.max(0, Math.round(rial / 10));
  }

  private toAtom(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private mapProduct(product: Product): EmallsProductRow | null {
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

    const inStock =
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

    if (!image_links.length) return null;

    const categories = (product.productCategories || [])
      .map((pc: any) => pc.category)
      .filter(Boolean);
    const category_name = categories[0]?.title
      ? String(categories[0].title)
      : '';

    const specObj: Record<string, string> = {};
    for (const s of product.specifications || []) {
      if (s?.label && s?.value != null) {
        specObj[String(s.label)] = String(s.value);
      }
    }
    const def = variants.find((v) => v.isDefault) || variants[0] || null;
    if (def) {
      for (const vav of def.variantAttributeValues || []) {
        const name = vav.attributeValue?.attribute?.name;
        const value = vav.attributeValue?.value;
        if (name && value != null && specObj[name] == null) {
          specObj[String(name)] = String(value);
        }
      }
      const sku = def.sku;
      if (sku && !specObj['شناسه کالا']) {
        specObj['شناسه کالا'] = String(sku);
      }
    }

    let guarantee = '';
    const guaranteeKeys = [
      'گارانتی',
      'guarantee',
      'warranty',
      'garanty',
      'گارانتی محصول',
      'ضمانت',
    ];
    for (const key of guaranteeKeys) {
      if (specObj[key]) {
        guarantee = specObj[key];
        break;
      }
    }

    let registry = '';
    for (const key of ['رجیستری', 'registry', 'ریجیستری', 'ریجستری']) {
      if (specObj[key]) {
        registry = specObj[key];
        break;
      }
    }

    // Official plugin wraps non-empty spec as [{ ... }]
    const spec =
      Object.keys(specObj).length > 0 ? [specObj] : ([] as Array<Record<string, string>>);

    return {
      title: String(product.name || ''),
      subtitle: product.brand?.name ? String(product.brand.name) : '',
      parent_id: 0,
      page_unique: this.pageUnique(product),
      current_price: inStock ? toman : 0,
      old_price: oldToman > toman && toman > 0 ? oldToman : '',
      availability: inStock ? 'instock' : 'outofstock',
      category_name,
      image_links,
      image_link: image_links[0] || null,
      page_url: this.pageUrl(product),
      short_desc: product.shortDescription
        ? String(product.shortDescription)
        : '',
      spec,
      date_added: this.toAtom(product.createdAt),
      date_updated: this.toAtom(product.updatedAt),
      product_type: product.type || 'variable',
      registry,
      guarantee,
    };
  }

  async listProducts(
    dto: EmallsProductsRequestDto,
    tokenFromHeader?: string,
  ) {
    const token = dto.token || tokenFromHeader;
    const auth = await this.auth.assertValidToken(token);

    if (!auth.ok) {
      return {
        status: auth.error?.includes('validation') ? 500 : 401,
        body: {
          Error: auth.error || 'Invalid token',
          plugin_version: this.auth.pluginVersion,
          shop_domain: this.auth.shopDomain(),
        },
      };
    }

    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(Math.max(1, dto.limit ?? 100), 100);

    const qb = this.productRepo
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
      .andWhere('p.isListedOnEmalls = true')
      .andWhere('p.deletedAt IS NULL')
      .orderBy('p.id', 'DESC');

    const count = await qb.clone().getCount();
    const max_pages = Math.max(1, Math.ceil(count / limit));
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const products = rows
      .map((p) => this.mapProduct(p))
      .filter((p): p is EmallsProductRow => Boolean(p));

    return {
      status: 200,
      body: {
        count,
        max_pages,
        products,
        Version: this.auth.pluginVersion,
        NeedSession: auth.needSession,
        TokenSendByEmalls: String(token || ''),
        SignedBy: 'livenmode.ir',
        metadata: {
          platform: 'liven-api',
          plugin_version: this.auth.pluginVersion,
          shop_domain: this.auth.shopDomain(),
        },
      },
    };
  }
}
