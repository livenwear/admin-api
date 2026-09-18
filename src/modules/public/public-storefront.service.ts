import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Attribute,
  Banner,
  Category,
  FileEntity,
  Price,
  Product,
  ProductImage,
  ProductLabel,
  ProductRelated,
  PromoCardRow,
  Review,
  Slider,
} from 'src/entities';
import { ProductStatus } from 'src/entities/enums';
import {
  generateProductPublicId,
  isProductPublicId,
} from 'src/common/utils/product-public-id';
import {
  generateCategoryPublicId,
  isCategoryPublicId,
} from 'src/common/utils/category-public-id';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { Brackets, Repository } from 'typeorm';

const PUBLIC_MEDIA_NAMESPACES = new Set<string>([
  StorageNamespace.BANNERS,
  StorageNamespace.SLIDERS,
  StorageNamespace.PROMO_CARDS,
  StorageNamespace.PRODUCTS,
  StorageNamespace.PRODUCT_CATEGORIES,
  StorageNamespace.BRANDS,
  StorageNamespace.CHAT,
  StorageNamespace.BLOG,
  StorageNamespace.BLOG_CATEGORIES,
  StorageNamespace.BLOG_TAGS,
  StorageNamespace.SHIPPING,
]);

export type PublicCategoryNode = {
  uuid: string;
  publicId: string | null;
  title: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  /** SVG logo */
  imageUrl: string | null;
  /** Cover / hero photo */
  coverImageUrl: string | null;
  children: PublicCategoryNode[];
};

export type PublicProductFilter = 'amazing' | 'featured' | 'newest' | 'all';
export type PublicProductSort =
  | 'newest'
  | 'popular'
  | 'price_asc'
  | 'price_desc'
  | 'discount';

@Injectable()
export class PublicStorefrontService {
  constructor(
    @InjectRepository(Banner)
    private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(Slider)
    private readonly sliderRepo: Repository<Slider>,
    @InjectRepository(PromoCardRow)
    private readonly promoRowRepo: Repository<PromoCardRow>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepo: Repository<ProductImage>,
    @InjectRepository(ProductRelated)
    private readonly productRelatedRepo: Repository<ProductRelated>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Attribute)
    private readonly attributeRepo: Repository<Attribute>,
    private readonly storageService: StorageService,
  ) {}

  mediaPath(fileUuid: string | null | undefined) {
    if (!fileUuid) return null;
    return `/public/media/${fileUuid}`;
  }

  async getBanners(position = 'top_promo') {
    const now = new Date();
    const rows = await this.bannerRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.file', 'file')
      .where('b.isActive = true')
      .andWhere('b.position = :position', { position })
      .andWhere('(b.startsAt IS NULL OR b.startsAt <= :now)', { now })
      .andWhere('(b.endsAt IS NULL OR b.endsAt >= :now)', { now })
      .orderBy('b.displayOrder', 'ASC')
      .addOrderBy('b.createdAt', 'DESC')
      .getMany();

    return {
      success: true,
      data: rows.map((b) => ({
        uuid: b.uuid,
        title: b.title,
        linkUrl: b.linkUrl,
        position: b.position,
        displayOrder: b.displayOrder,
        imageUrl: this.mediaPath((b.file as FileEntity | undefined)?.uuid),
        fileUuid: (b.file as FileEntity | undefined)?.uuid ?? null,
      })),
    };
  }

  async getSliderBySlug(slug: string) {
    const slider = await this.sliderRepo.findOne({
      where: { slug, isActive: true },
      relations: ['items', 'items.file'],
    });
    if (!slider) throw new NotFoundException('Slider not found.');

    const items = (slider.items || [])
      .filter((item) => item.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => {
        const file = item.file as FileEntity | undefined;
        return {
          uuid: item.uuid,
          title: item.title,
          subtitle: item.subtitle,
          linkUrl: item.linkUrl,
          buttonText: item.buttonText,
          textColor: item.textColor,
          overlayColor: item.overlayColor,
          displayOrder: item.displayOrder,
          imageUrl: this.mediaPath(file?.uuid),
          fileUuid: file?.uuid ?? null,
        };
      });

    return {
      success: true,
      data: {
        uuid: slider.uuid,
        name: slider.name,
        slug: slider.slug,
        items,
      },
    };
  }

  /** Active homepage promo card rows ordered by slot (1–5) */
  async listPromoCardRows() {
    const rows = await this.promoRowRepo.find({
      where: { isActive: true },
      relations: ['cards', 'cards.file'],
      order: { slot: 'ASC' },
    });

    return {
      success: true,
      data: rows
        .map((row) => {
          const limit = Math.min(5, Math.max(1, row.visibleCount || 5));
          const cards = (row.cards || [])
            .filter(
              (c) => c.isActive && (c.file as FileEntity | undefined)?.uuid,
            )
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .slice(0, limit)
            .map((card) => {
              const file = card.file as FileEntity | undefined;
              return {
                uuid: card.uuid,
                title: card.title,
                linkUrl: card.linkUrl,
                displayOrder: card.displayOrder,
                imageUrl: this.mediaPath(file?.uuid),
                fileUuid: file?.uuid ?? null,
              };
            });
          return {
            uuid: row.uuid,
            title: row.title,
            slot: row.slot,
            visibleCount: limit,
            cards,
          };
        })
        .filter((row) => row.cards.length > 0),
    };
  }

  async getCategoryTree() {
    const rows = await this.categoryRepo.find({
      where: { isActive: true },
      relations: ['parent'],
      order: { displayOrder: 'ASC', title: 'ASC' },
    });

    // Ensure every active category has a stable public id
    for (const c of rows) {
      if (!c.publicId) {
        c.publicId = await this.allocateCategoryPublicId();
        await this.categoryRepo.update(c.id, { publicId: c.publicId });
      }
    }

    const map = new Map<string, PublicCategoryNode>();
    for (const c of rows) {
      map.set(c.uuid, {
        uuid: c.uuid,
        publicId: c.publicId,
        title: c.title,
        slug: c.slug,
        description: c.description,
        displayOrder: c.displayOrder,
        imageUrl: this.mediaPath(this.extractCategoryFileUuid(c.imageUrl)),
        coverImageUrl: this.mediaPath(
          this.extractCategoryFileUuid(c.coverImageUrl),
        ),
        children: [],
      });
    }

    const roots: PublicCategoryNode[] = [];
    for (const c of rows) {
      const node = map.get(c.uuid)!;
      const parentUuid = (c.parent as Category | undefined)?.uuid;
      if (parentUuid && map.has(parentUuid)) {
        map.get(parentUuid)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return { success: true, data: roots };
  }

  /**
   * Fashion gallery feed: product photos ordered by product.createdAt DESC
   * (newest products first), then primary/displayOrder within product.
   */
  async listGallery(opts: { page?: number; limit?: number; categorySlug?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(Math.max(opts.limit ?? 24, 1), 48);

    const categorySlugs = opts.categorySlug
      ? await this.resolveCategorySlugScope(opts.categorySlug)
      : null;

    const qb = this.productImageRepo
      .createQueryBuilder('img')
      .innerJoinAndSelect('img.file', 'file')
      .innerJoinAndSelect('img.product', 'p')
      .where('p.status = :status', { status: ProductStatus.ACTIVE })
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('img.isPrimary', 'DESC')
      .addOrderBy('img.displayOrder', 'ASC')
      .addOrderBy('img.id', 'ASC');

    if (categorySlugs?.length) {
      qb.innerJoin('p.productCategories', 'pc')
        .innerJoin('pc.category', 'category')
        .andWhere('category.slug IN (:...catSlugs)', {
          catSlugs: categorySlugs,
        })
        .distinct(true);
    }

    const total = await qb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    return {
      success: true,
      data: rows.map((img) => {
        const product = img.product as Product;
        const file = img.file as FileEntity | undefined;
        return {
          uuid: img.uuid,
          imageUrl: this.mediaPath(file?.uuid),
          fileUuid: file?.uuid ?? null,
          altText: img.altText || product?.name || null,
          productUuid: product?.uuid,
          productPublicId: product?.publicId ?? null,
          productSlug: product?.slug,
          createdAt: product?.createdAt,
        };
      }),
      meta: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
        categorySlug: opts.categorySlug || null,
      },
    };
  }

  private extractCategoryFileUuid(imageUrl: string | null) {
    if (!imageUrl) return null;
    const m = /^file:\/\/(.+)$/i.exec(imageUrl.trim());
    return m?.[1] || null;
  }

  private async allocateCategoryPublicId() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = generateCategoryPublicId();
      const existing = await this.categoryRepo.findOne({
        where: { publicId: candidate },
      });
      if (!existing) return candidate;
    }
    return generateCategoryPublicId(8);
  }

  /**
   * Resolve category by slug first, then publicId, then uuid (legacy).
   * Used for secure storefront URLs.
   */
  async resolveCategoryKey(rawKey: string) {
    const key = this.normalizePublicKey(rawKey);
    if (!key) return null;

    const bySlug = await this.categoryRepo.findOne({
      where: { slug: key, isActive: true },
    });
    if (bySlug) {
      if (!bySlug.publicId) {
        bySlug.publicId = await this.allocateCategoryPublicId();
        await this.categoryRepo.update(bySlug.id, {
          publicId: bySlug.publicId,
        });
      }
      return bySlug;
    }

    if (isCategoryPublicId(key) || /^lvc_/i.test(key)) {
      const byPublic = await this.categoryRepo.findOne({
        where: { publicId: key, isActive: true },
      });
      if (byPublic) return byPublic;
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(key)) {
      return this.categoryRepo.findOne({
        where: { uuid: key, isActive: true },
      });
    }

    return null;
  }

  /** Include the category itself + all descendant slugs for listing scope */
  private async resolveCategorySlugScope(slug: string): Promise<string[]> {
    const all = await this.categoryRepo.find({
      where: { isActive: true },
      relations: ['parent'],
    });
    const root = all.find((c) => c.slug === slug);
    if (!root) return [slug];

    const childrenOf = new Map<string, typeof all>();
    for (const c of all) {
      const parentUuid = (c.parent as Category | undefined)?.uuid;
      if (!parentUuid) continue;
      const list = childrenOf.get(parentUuid) || [];
      list.push(c);
      childrenOf.set(parentUuid, list);
    }

    const slugs: string[] = [];
    const walk = (node: (typeof all)[number]) => {
      slugs.push(node.slug);
      for (const child of childrenOf.get(node.uuid) || []) walk(child);
    };
    walk(root);
    return slugs.length ? slugs : [slug];
  }

  async listProducts(opts: {
    filter?: PublicProductFilter;
    page?: number;
    limit?: number;
    categorySlug?: string;
    q?: string;
    sort?: PublicProductSort;
    minPrice?: number;
    maxPrice?: number;
    attrs?: string;
    onSale?: boolean;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 48);
    const filter = opts.filter || 'all';
    const q = (opts.q || '').trim();
    const sort = opts.sort || (filter === 'newest' ? 'newest' : filter === 'featured' ? 'popular' : 'newest');
    const attrMap = this.parseAttrFilters(opts.attrs);

    const minPriceSql = `(SELECT COALESCE(MIN(pr.amount::numeric), 0)
      FROM prices pr
      INNER JOIN product_variants pv ON pv.id = pr.variant_id
      WHERE pv.product_id = p.id AND pv."isActive" = true AND pr."isActive" = true)`;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.images', 'images')
      .leftJoinAndSelect('images.file', 'imageFile')
      .leftJoinAndSelect('p.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .leftJoinAndSelect('variants.variantAttributeValues', 'vav')
      .leftJoinAndSelect('vav.attributeValue', 'attrValue')
      .leftJoinAndSelect('attrValue.attribute', 'attribute')
      .leftJoinAndSelect('p.labels', 'labels')
      .leftJoinAndSelect('p.productCategories', 'pc')
      .leftJoinAndSelect('pc.category', 'category')
      .where('p.status = :status', { status: ProductStatus.ACTIVE });

    if (filter === 'amazing') {
      qb.andWhere('p.isAmazing = true');
    } else if (filter === 'featured') {
      qb.andWhere('p.isFeatured = true');
    }

    const categorySlugs = opts.categorySlug
      ? await this.resolveCategorySlugScope(opts.categorySlug)
      : null;
    if (categorySlugs?.length) {
      qb.andWhere('category.slug IN (:...catSlugs)', {
        catSlugs: categorySlugs,
      });
    }

    if (q.length >= 1) {
      const like = `%${q}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('p.name ILIKE :like', { like })
            .orWhere('p.slug ILIKE :like', { like })
            .orWhere('p.shortDescription ILIKE :like', { like })
            .orWhere('p.description ILIKE :like', { like })
            .orWhere('p.metaKeywords ILIKE :like', { like });
        }),
      );
    }

    if (opts.minPrice != null && Number.isFinite(opts.minPrice)) {
      qb.andWhere(`${minPriceSql} >= :minPrice`, {
        minPrice: opts.minPrice,
      });
    }
    if (opts.maxPrice != null && Number.isFinite(opts.maxPrice)) {
      qb.andWhere(`${minPriceSql} <= :maxPrice`, {
        maxPrice: opts.maxPrice,
      });
    }

    if (opts.onSale) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM product_variants pv2
          INNER JOIN prices pr2 ON pr2.variant_id = pv2.id
          WHERE pv2.product_id = p.id AND pv2."isActive" = true AND pr2."isActive" = true
            AND pr2."compareAtAmount" IS NOT NULL
            AND pr2."compareAtAmount"::numeric > pr2.amount::numeric
        )`,
      );
    }

    let ai = 0;
    for (const [attrSlug, values] of attrMap) {
      const slugKey = `attrSlug${ai}`;
      const valsKey = `attrVals${ai}`;
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM variant_attribute_values vavx
          INNER JOIN product_variants pvx ON pvx.id = vavx.variant_id
          INNER JOIN attribute_values avx ON avx.id = vavx.attribute_value_id
          INNER JOIN attributes ax ON ax.id = avx.attribute_id
          WHERE pvx.product_id = p.id AND ax.slug = :${slugKey}
            AND avx.slug IN (:...${valsKey})
        )`,
        { [slugKey]: attrSlug, [valsKey]: values },
      );
      ai += 1;
    }

    qb.addSelect(minPriceSql, 'sort_price');

    if (sort === 'price_asc') {
      qb.orderBy('sort_price', 'ASC').addOrderBy('p.createdAt', 'DESC');
    } else if (sort === 'price_desc') {
      qb.orderBy('sort_price', 'DESC').addOrderBy('p.createdAt', 'DESC');
    } else if (sort === 'popular') {
      qb.orderBy('p.viewCount', 'DESC').addOrderBy('p.createdAt', 'DESC');
    } else if (sort === 'discount') {
      qb.orderBy(
        `CASE WHEN EXISTS (
          SELECT 1 FROM product_variants pvd
          INNER JOIN prices prd ON prd.variant_id = pvd.id
          WHERE pvd.product_id = p.id AND prd."isActive" = true
            AND prd."compareAtAmount" IS NOT NULL
            AND prd."compareAtAmount"::numeric > prd.amount::numeric
        ) THEN 0 ELSE 1 END`,
        'ASC',
      )
        .addOrderBy('p.updatedAt', 'DESC');
    } else if (filter === 'amazing') {
      qb.orderBy('p.updatedAt', 'DESC');
    } else {
      qb.orderBy('p.createdAt', 'DESC');
    }

    const countQb = this.productRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: ProductStatus.ACTIVE });
    if (filter === 'amazing') countQb.andWhere('p.isAmazing = true');
    if (filter === 'featured') countQb.andWhere('p.isFeatured = true');
    if (categorySlugs?.length) {
      countQb
        .leftJoin('p.productCategories', 'pc')
        .leftJoin('pc.category', 'category')
        .andWhere('category.slug IN (:...catSlugs)', {
          catSlugs: categorySlugs,
        });
    }
    if (q.length >= 1) {
      const like = `%${q}%`;
      countQb.andWhere(
        new Brackets((w) => {
          w.where('p.name ILIKE :like', { like })
            .orWhere('p.slug ILIKE :like', { like })
            .orWhere('p.shortDescription ILIKE :like', { like })
            .orWhere('p.description ILIKE :like', { like })
            .orWhere('p.metaKeywords ILIKE :like', { like });
        }),
      );
    }
    if (opts.minPrice != null && Number.isFinite(opts.minPrice)) {
      countQb.andWhere(`${minPriceSql} >= :minPrice`, {
        minPrice: opts.minPrice,
      });
    }
    if (opts.maxPrice != null && Number.isFinite(opts.maxPrice)) {
      countQb.andWhere(`${minPriceSql} <= :maxPrice`, {
        maxPrice: opts.maxPrice,
      });
    }
    if (opts.onSale) {
      countQb.andWhere(
        `EXISTS (
          SELECT 1 FROM product_variants pv2
          INNER JOIN prices pr2 ON pr2.variant_id = pv2.id
          WHERE pv2.product_id = p.id AND pv2."isActive" = true AND pr2."isActive" = true
            AND pr2."compareAtAmount" IS NOT NULL
            AND pr2."compareAtAmount"::numeric > pr2.amount::numeric
        )`,
      );
    }
    ai = 0;
    for (const [attrSlug, values] of attrMap) {
      const slugKey = `attrSlug${ai}`;
      const valsKey = `attrVals${ai}`;
      countQb.andWhere(
        `EXISTS (
          SELECT 1 FROM variant_attribute_values vavx
          INNER JOIN product_variants pvx ON pvx.id = vavx.variant_id
          INNER JOIN attribute_values avx ON avx.id = vavx.attribute_value_id
          INNER JOIN attributes ax ON ax.id = avx.attribute_id
          WHERE pvx.product_id = p.id AND ax.slug = :${slugKey}
            AND avx.slug IN (:...${valsKey})
        )`,
        { [slugKey]: attrSlug, [valsKey]: values },
      );
      ai += 1;
    }

    const total = await countQb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    const ratings = await this.getRatingsMap(rows.map((p) => p.id));
    const data = rows.map((p) =>
      this.mapProductCard(p, false, ratings.get(p.id)),
    );

    return {
      success: true,
      data,
      meta: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
        filter,
        categorySlug: opts.categorySlug || null,
        q: q || null,
        sort,
        minPrice: opts.minPrice ?? null,
        maxPrice: opts.maxPrice ?? null,
        attrs: opts.attrs || null,
        onSale: Boolean(opts.onSale),
      },
    };
  }

  /** Facets for shop filters — filterable attributes + price bounds */
  async getCatalogFacets(opts?: { categorySlug?: string; q?: string }) {
    const q = (opts?.q || '').trim();
    const categorySlugs = opts?.categorySlug
      ? await this.resolveCategorySlugScope(opts.categorySlug)
      : null;

    const priceQb = this.productRepo
      .createQueryBuilder('p')
      .innerJoin('p.variants', 'v')
      .innerJoin('v.prices', 'pr')
      .select('MIN(pr.amount::numeric)', 'min')
      .addSelect('MAX(pr.amount::numeric)', 'max')
      .where('p.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('v.isActive = true')
      .andWhere('pr.isActive = true');

    if (categorySlugs?.length) {
      priceQb
        .innerJoin('p.productCategories', 'pc')
        .innerJoin('pc.category', 'category')
        .andWhere('category.slug IN (:...catSlugs)', {
          catSlugs: categorySlugs,
        });
    }
    if (q.length >= 1) {
      const like = `%${q}%`;
      priceQb.andWhere(
        new Brackets((w) => {
          w.where('p.name ILIKE :like', { like }).orWhere(
            'p.slug ILIKE :like',
            { like },
          );
        }),
      );
    }

    const priceRow = await priceQb.getRawOne<{
      min: string | null;
      max: string | null;
    }>();

    const attributes = await this.attributeRepo.find({
      where: { isFilterable: true, isVisible: true },
      relations: ['values'],
      order: { displayOrder: 'ASC' },
    });

    return {
      success: true,
      data: {
        price: {
          min: priceRow?.min != null ? Number(priceRow.min) : null,
          max: priceRow?.max != null ? Number(priceRow.max) : null,
        },
        attributes: attributes.map((a) => ({
          uuid: a.uuid,
          name: a.name,
          slug: a.slug,
          type: a.type,
          values: ((a.values as any[]) || [])
            .slice()
            .sort((x, y) => (x.displayOrder || 0) - (y.displayOrder || 0))
            .map((v) => ({
              uuid: v.uuid,
              value: v.value,
              slug: v.slug,
              colorCode: v.colorCode ?? null,
            })),
        })),
      },
    };
  }

  private parseAttrFilters(raw?: string) {
    const map = new Map<string, string[]>();
    if (!raw?.trim()) return map;
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(':');
      if (colon <= 0) continue;
      const slug = trimmed.slice(0, colon).trim().toLowerCase();
      const value = trimmed.slice(colon + 1).trim().toLowerCase();
      if (!slug || !value) continue;
      const list = map.get(slug) || [];
      if (!list.includes(value)) list.push(value);
      map.set(slug, list);
    }
    return map;
  }

  async searchProducts(q: string, limit = 12) {
    const query = (q || '').trim();
    if (query.length < 1) {
      return { success: true, data: [], meta: { q: query, total: 0 } };
    }

    const take = Math.min(Math.max(limit, 1), 40);
    const like = `%${query}%`;
    const prefix = `${query}%`;

    const rows = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.images', 'images')
      .leftJoinAndSelect('images.file', 'imageFile')
      .leftJoinAndSelect('p.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .leftJoinAndSelect('variants.variantAttributeValues', 'vav')
      .leftJoinAndSelect('vav.attributeValue', 'attrValue')
      .leftJoinAndSelect('attrValue.attribute', 'attribute')
      .leftJoinAndSelect('p.labels', 'labels')
      .where('p.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere(
        new Brackets((qb) => {
          qb.where('p.name ILIKE :like', { like })
            .orWhere('p.slug ILIKE :like', { like })
            .orWhere('p.shortDescription ILIKE :like', { like })
            .orWhere('p.description ILIKE :like', { like })
            .orWhere('p.metaKeywords ILIKE :like', { like });
        }),
      )
      .orderBy('p.viewCount', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .take(Math.min(take * 3, 60))
      .getMany();

    const qLower = query.toLowerCase();
    const ranked = rows
      .map((p) => {
        const name = (p.name || '').toLowerCase();
        const slug = (p.slug || '').toLowerCase();
        let score = 4;
        if (name === qLower) score = 0;
        else if (name.startsWith(qLower)) score = 1;
        else if (slug.startsWith(qLower)) score = 2;
        else if (name.includes(qLower)) score = 3;
        return { p, score };
      })
      .sort((a, b) => a.score - b.score || b.p.viewCount - a.p.viewCount)
      .slice(0, take)
      .map((x) => x.p);

    const ratings = await this.getRatingsMap(ranked.map((p) => p.id));

    return {
      success: true,
      data: ranked.map((p) => this.mapProductCard(p, false, ratings.get(p.id))),
      meta: { q: query, total: ranked.length },
    };
  }

  async getProductBySlug(slug: string) {
    const product = await this.resolveActiveProduct(slug);
    if (!product) throw new NotFoundException('Product not found.');

    if (!product.publicId) {
      product.publicId = await this.allocatePublicId();
      await this.productRepo.update(product.id, { publicId: product.publicId });
    }

    // Soft view counter for popularity signals
    await this.productRepo.increment({ id: product.id }, 'viewCount', 1);

    const ratings = await this.getRatingsMap([product.id]);
    const card = this.mapProductCard(product, true, ratings.get(product.id));
    const similarProducts = await this.loadSimilarProducts(product);

    return {
      success: true,
      data: {
        ...card,
        similarProducts,
      },
    };
  }

  async getProductReviews(
    slug: string,
    page = 1,
    limit = 10,
  ) {
    const product = await this.resolveActiveProduct(slug, { light: true });
    if (!product) throw new NotFoundException('Product not found.');

    const take = Math.min(Math.max(limit, 1), 40);
    const safePage = Math.max(1, page);
    const [rows, total] = await this.reviewRepo.findAndCount({
      where: { productId: product.id, isApproved: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * take,
      take,
    });

    const totalPages = Math.max(1, Math.ceil(total / take) || 1);
    return {
      success: true,
      data: rows.map((r) => ({
        uuid: r.uuid,
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt,
        userName: this.maskReviewerName(r.user),
        adminReply: r.adminReply,
        repliedAt: r.repliedAt,
      })),
      meta: {
        page: safePage,
        limit: take,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
        productUuid: product.uuid,
        productSlug: product.slug,
      },
    };
  }

  /** Resolve by publicId (preferred), UUID (legacy), or slug (fa/en) */
  private async resolveActiveProduct(
    rawKey: string,
    opts?: { light?: boolean },
  ) {
    const key = this.normalizePublicKey(rawKey);
    if (!key) return null;

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (opts?.light) {
      if (isProductPublicId(key) || /^lvn_/i.test(key)) {
        const byPublic = await this.productRepo.findOne({
          where: { publicId: key, status: ProductStatus.ACTIVE },
          select: ['id', 'uuid', 'publicId', 'slug', 'name'],
        });
        if (byPublic) return byPublic;
      }
      if (uuidRe.test(key)) {
        return this.productRepo.findOne({
          where: { uuid: key, status: ProductStatus.ACTIVE },
          select: ['id', 'uuid', 'publicId', 'slug', 'name'],
        });
      }
      return this.productRepo.findOne({
        where: { slug: key, status: ProductStatus.ACTIVE },
        select: ['id', 'uuid', 'publicId', 'slug', 'name'],
      });
    }

    const relations = [
      'images',
      'images.file',
      'variants',
      'variants.prices',
      'variants.variantAttributeValues',
      'variants.variantAttributeValues.attributeValue',
      'variants.variantAttributeValues.attributeValue.attribute',
      'brand',
      'labels',
      'specifications',
      'productCategories',
      'productCategories.category',
    ];

    if (isProductPublicId(key) || /^lvn_/i.test(key)) {
      const byPublic = await this.productRepo.findOne({
        where: { publicId: key, status: ProductStatus.ACTIVE },
        relations,
      });
      if (byPublic) return byPublic;
    }

    if (uuidRe.test(key)) {
      return this.productRepo.findOne({
        where: { uuid: key, status: ProductStatus.ACTIVE },
        relations,
      });
    }

    return this.productRepo.findOne({
      where: { slug: key, status: ProductStatus.ACTIVE },
      relations,
    });
  }

  private async allocatePublicId() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = generateProductPublicId();
      const existing = await this.productRepo.findOne({
        where: { publicId: candidate },
      });
      if (!existing) return candidate;
    }
    return generateProductPublicId(8);
  }

  /** Related products first; fill with same-category actives */
  private async loadSimilarProducts(product: Product, limit = 12) {
    const relatedLinks = await this.productRelatedRepo.find({
      where: { productId: product.id },
      order: { id: 'ASC' },
    });

    const relatedIds = relatedLinks
      .map((r) => r.relatedProductId)
      .filter(Boolean);

    const collected: Product[] = [];

    if (relatedIds.length) {
      const relatedProducts = await this.productRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.images', 'images')
        .leftJoinAndSelect('images.file', 'imageFile')
        .leftJoinAndSelect('p.variants', 'variants')
        .leftJoinAndSelect('variants.prices', 'prices')
        .leftJoinAndSelect('variants.variantAttributeValues', 'vav')
        .leftJoinAndSelect('vav.attributeValue', 'attrValue')
        .leftJoinAndSelect('attrValue.attribute', 'attribute')
        .leftJoinAndSelect('p.labels', 'labels')
        .leftJoinAndSelect('p.productCategories', 'pc')
        .leftJoinAndSelect('pc.category', 'category')
        .where('p.status = :status', { status: ProductStatus.ACTIVE })
        .andWhere('p.id IN (:...ids)', { ids: relatedIds })
        .getMany();

      const order = new Map(relatedIds.map((id, i) => [id, i]));
      relatedProducts.sort(
        (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
      );
      collected.push(...relatedProducts);
    }

    if (collected.length < limit) {
      const categoryIds = (product.productCategories || [])
        .map((pc: any) => pc.category?.id || pc.categoryId)
        .filter(Boolean);
      const excludeIds = [product.id, ...collected.map((p) => p.id)];

      const qb = this.productRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.images', 'images')
        .leftJoinAndSelect('images.file', 'imageFile')
        .leftJoinAndSelect('p.variants', 'variants')
        .leftJoinAndSelect('variants.prices', 'prices')
        .leftJoinAndSelect('variants.variantAttributeValues', 'vav')
        .leftJoinAndSelect('vav.attributeValue', 'attrValue')
        .leftJoinAndSelect('attrValue.attribute', 'attribute')
        .leftJoinAndSelect('p.labels', 'labels')
        .leftJoinAndSelect('p.productCategories', 'pc')
        .leftJoinAndSelect('pc.category', 'category')
        .where('p.status = :status', { status: ProductStatus.ACTIVE })
        .andWhere('p.id NOT IN (:...excludeIds)', { excludeIds })
        .orderBy('p.isFeatured', 'DESC')
        .addOrderBy('p.viewCount', 'DESC')
        .addOrderBy('p.createdAt', 'DESC')
        .take(limit - collected.length);

      if (categoryIds.length) {
        qb.andWhere('category.id IN (:...categoryIds)', { categoryIds });
      }

      const fillers = await qb.getMany();
      collected.push(...fillers);
    }

    if (!collected.length) return [];

    const ratings = await this.getRatingsMap(collected.map((p) => p.id));
    return collected.map((p) =>
      this.mapProductCard(p, false, ratings.get(p.id)),
    );
  }

  private normalizePublicKey(raw: string) {
    let key = (raw || '').trim();
    if (!key) return '';
    for (let i = 0; i < 3; i++) {
      try {
        const decoded = decodeURIComponent(key);
        if (decoded === key) break;
        key = decoded;
      } catch {
        break;
      }
    }
    return key.trim();
  }

  private maskReviewerName(user: {
    firstName?: string;
    lastName?: string;
  } | null) {
    const first = (user?.firstName || '').trim();
    const last = (user?.lastName || '').trim();
    if (!first && !last) return 'خریدار لیون';
    if (first && last) return `${first} ${last.charAt(0)}.`;
    return first || last;
  }

  async streamMedia(uuid: string) {
    const file = await this.fileRepo.findOne({ where: { uuid } });
    if (!file) throw new NotFoundException('Media not found.');
    if (!PUBLIC_MEDIA_NAMESPACES.has(file.namespace)) {
      throw new BadRequestException('Media is not publicly accessible.');
    }
    const stream = await this.storageService.getObjectStream(
      file.bucket,
      file.objectKey,
    );
    return { file, stream };
  }

  private async getRatingsMap(productIds: number[]) {
    const map = new Map<number, { avg: number; count: number }>();
    if (!productIds.length) return map;
    const rows = await this.reviewRepo
      .createQueryBuilder('r')
      .select('r.productId', 'productId')
      .addSelect('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.isApproved = true')
      .andWhere('r.productId IN (:...ids)', { ids: productIds })
      .groupBy('r.productId')
      .getRawMany<{ productId: string; avg: string; cnt: string }>();

    for (const row of rows) {
      map.set(Number(row.productId), {
        avg: Math.round(Number(row.avg) * 10) / 10,
        count: Number(row.cnt),
      });
    }
    return map;
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

    // "new" badge removed — not shown on storefront cards
    const now = Date.now();
    for (const raw of product.labels || []) {
      const label = raw as ProductLabel;
      if (!label.isActive) continue;
      if (label.startsAt && new Date(label.startsAt).getTime() > now) continue;
      if (label.endsAt && new Date(label.endsAt).getTime() < now) continue;
      const text = (label.label || '').trim();
      if (!text) continue;
      if (badges.some((b) => b.label === text)) continue;
      badges.push({
        key: `label-${label.uuid || text}`,
        label: text,
        tone: 'custom',
        colorCode: label.colorCode || '#30364F',
      });
    }

    return badges;
  }

  private extractSizes(product: Product): string[] {
    const sizes = new Set<string>();
    for (const v of product.variants || []) {
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

  private mapProductCard(
    product: Product,
    detailed = false,
    rating?: { avg: number; count: number },
  ) {
    const images = (product.images || [])
      .slice()
      .sort(
        (a: ProductImage, b: ProductImage) => a.displayOrder - b.displayOrder,
      );
    const primary =
      images.find((img: ProductImage) => img.isPrimary) || images[0];
    const file = primary?.file as FileEntity | undefined;

    let price: number | null = null;
    let compareAtPrice: number | null = null;
    for (const v of product.variants || []) {
      const active =
        (v.prices || []).find((p: Price) => p.isActive) || v.prices?.[0];
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

    const live = rating?.count ? rating : null;
    const ratingAvg = live
      ? live.avg
      : Number(product.ratingAvg || 0);
    const ratingCount = live
      ? live.count
      : product.ratingCount || 0;

    const base = {
      uuid: product.uuid,
      publicId: product.publicId,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      imageUrl: this.mediaPath(file?.uuid),
      fileUuid: file?.uuid ?? null,
      price,
      compareAtPrice,
      discountPercent,
      isFeatured: product.isFeatured,
      isAmazing: product.isAmazing,
      isUnavailable: Boolean(product.isUnavailable),
      badges: this.buildBadges(product),
      ratingAvg,
      ratingCount,
      sizes: this.extractSizes(product),
      categories: (product.productCategories || [])
        .map((pc: any) => pc.category)
        .filter(Boolean)
        .map((c: Category) => ({
          uuid: c.uuid,
          publicId: c.publicId,
          title: c.title,
          slug: c.slug,
        })),
    };

    if (!detailed) return base;

    const activeVariants = (product.variants || []).filter(
      (v) => v.isActive !== false,
    );

    return {
      ...base,
      description: product.description,
      expertReview: product.expertReview,
      brandName: product.brand?.name ?? null,
      brandSlug: product.brand?.slug ?? null,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      metaKeywords: product.metaKeywords,
      viewCount: product.viewCount,
      createdAt: product.createdAt,
      specifications: (product.specifications || [])
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => ({
          uuid: s.uuid,
          label: s.label,
          value: s.value,
          displayOrder: s.displayOrder,
        })),
      variants: activeVariants.map((v) => {
        const active =
          (v.prices || []).find((p: Price) => p.isActive) || v.prices?.[0];
        return {
          uuid: v.uuid,
          sku: v.sku,
          title: v.title,
          isDefault: v.isDefault,
          price: active ? Number(active.amount) : null,
          compareAtPrice: active?.compareAtAmount
            ? Number(active.compareAtAmount)
            : null,
          attributes: (v.variantAttributeValues || []).map((vav: any) => ({
            name: vav.attributeValue?.attribute?.name ?? null,
            slug: vav.attributeValue?.attribute?.slug ?? null,
            value: vav.attributeValue?.value ?? null,
            colorCode: vav.attributeValue?.colorCode ?? null,
          })),
        };
      }),
      attributeGroups: this.extractAttributeGroups(activeVariants),
      images: images.map((img: ProductImage) => ({
        uuid: img.uuid,
        altText: img.altText,
        isPrimary: img.isPrimary,
        imageUrl: this.mediaPath((img.file as FileEntity | undefined)?.uuid),
      })),
    };
  }

  private extractAttributeGroups(variants: any[]) {
    const groups = new Map<
      string,
      {
        name: string;
        slug: string;
        isCustomerSelectable: boolean;
        values: Map<
          string,
          { value: string; colorCode: string | null }
        >;
      }
    >();

    for (const v of variants) {
      for (const vav of v.variantAttributeValues || []) {
        const attr = vav.attributeValue?.attribute;
        const value = vav.attributeValue?.value;
        if (!attr?.name || !value) continue;
        const slug = attr.slug || attr.name;
        const key = slug.toLowerCase();
        if (!groups.has(key)) {
          groups.set(key, {
            name: attr.name,
            slug,
            isCustomerSelectable: attr.isCustomerSelectable !== false,
            values: new Map(),
          });
        }
        const g = groups.get(key)!;
        const vk = String(value).trim();
        if (!g.values.has(vk)) {
          g.values.set(vk, {
            value: vk,
            colorCode: vav.attributeValue?.colorCode ?? null,
          });
        }
      }
    }

    return Array.from(groups.values()).map((g) => ({
      name: g.name,
      slug: g.slug,
      isCustomerSelectable: g.isCustomerSelectable,
      values: Array.from(g.values.values()),
    }));
  }
}
