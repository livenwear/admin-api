import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sanitizeBlogHtml } from 'src/common/utils/blog-html';
import {
  Post,
  PostCategory,
  PostStatus,
  PostTag,
  Product,
  ProductImage,
  ProductStatus,
} from 'src/entities';
import { PublicMagListQueryDto } from '../admin/blog/dto/blog.dto';
import { PublicStorefrontService } from './public-storefront.service';

@Injectable()
export class PublicMagService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(PostCategory)
    private readonly categoryRepo: Repository<PostCategory>,
    @InjectRepository(PostTag)
    private readonly tagRepo: Repository<PostTag>,
    private readonly storefront: PublicStorefrontService,
  ) {}

  private mediaPath(uuid?: string | null) {
    return uuid ? `/public/media/${uuid}` : null;
  }

  private publishedQb(alias = 'p') {
    const now = new Date();
    return this.postRepo
      .createQueryBuilder(alias)
      .where(`${alias}.status = :st`, { st: PostStatus.PUBLISHED })
      .andWhere(`${alias}.publishedAt IS NOT NULL`)
      .andWhere(`${alias}.publishedAt <= :now`, { now });
  }

  private cardFromPost(post: Post) {
    const coverUuid = post.featuredImageFile?.uuid || null;
    const cats =
      post.categoryRelations
        ?.map((r) => r.category)
        .filter(Boolean)
        .map((c: PostCategory) => ({
          uuid: c.uuid,
          name: c.name,
          slug: c.slug,
        })) || [];
    return {
      uuid: post.uuid,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      publishedAt: post.publishedAt,
      readingTimeMinutes: post.readingTimeMinutes || 1,
      isFeatured: Boolean(post.isFeatured),
      featuredImageAlt: post.featuredImageAlt,
      featuredImageUrl: this.mediaPath(coverUuid),
      categories: cats,
      author: post.author
        ? {
            firstName: post.author.firstName,
            lastName: post.author.lastName,
          }
        : null,
    };
  }

  async list(query: PublicMagListQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 48);
    const qb = this.publishedQb('p')
      .leftJoinAndSelect('p.author', 'author')
      .leftJoinAndSelect('p.featuredImageFile', 'cover')
      .leftJoinAndSelect('p.categoryRelations', 'cr')
      .leftJoinAndSelect('cr.category', 'cat')
      .orderBy('p.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.category?.trim()) {
      qb.andWhere('cat.slug = :cSlug', { cSlug: query.category.trim() });
    }
    if (query.tag?.trim()) {
      qb.leftJoin('p.tagRelations', 'tr')
        .leftJoin('tr.tag', 'tag')
        .andWhere('tag.slug = :tSlug', { tSlug: query.tag.trim() });
    }
    if (query.q?.trim()) {
      qb.andWhere(
        '(p.title ILIKE :q OR p.excerpt ILIKE :q OR p.metaKeywords ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      success: true,
      data: rows.map((p) => this.cardFromPost(p)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async featured(limit = 4) {
    const take = Math.min(Math.max(Number(limit) || 4, 1), 24);
    const rows = await this.publishedQb('p')
      .leftJoinAndSelect('p.author', 'author')
      .leftJoinAndSelect('p.featuredImageFile', 'cover')
      .leftJoinAndSelect('p.categoryRelations', 'cr')
      .leftJoinAndSelect('cr.category', 'cat')
      .andWhere('p.isFeatured = true')
      .orderBy('p.publishedAt', 'DESC')
      .take(take)
      .getMany();

    // Fallback: latest published if no featured
    if (!rows.length) {
      const latest = await this.publishedQb('p')
        .leftJoinAndSelect('p.author', 'author')
        .leftJoinAndSelect('p.featuredImageFile', 'cover')
        .leftJoinAndSelect('p.categoryRelations', 'cr')
        .leftJoinAndSelect('cr.category', 'cat')
        .orderBy('p.publishedAt', 'DESC')
        .take(take)
        .getMany();
      return { success: true, data: latest.map((p) => this.cardFromPost(p)) };
    }

    return { success: true, data: rows.map((p) => this.cardFromPost(p)) };
  }

  async bySlug(slug: string) {
    const post = await this.publishedQb('p')
      .leftJoinAndSelect('p.author', 'author')
      .leftJoinAndSelect('p.featuredImageFile', 'cover')
      .leftJoinAndSelect('p.ogImageFile', 'og')
      .leftJoinAndSelect('p.categoryRelations', 'cr')
      .leftJoinAndSelect('cr.category', 'cat')
      .leftJoinAndSelect('p.tagRelations', 'tr')
      .leftJoinAndSelect('tr.tag', 'tag')
      .leftJoinAndSelect('p.postProducts', 'pp')
      .leftJoinAndSelect('pp.product', 'product')
      .leftJoinAndSelect('product.images', 'pimg')
      .leftJoinAndSelect('pimg.file', 'pimgFile')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .leftJoinAndSelect('p.postShopCategories', 'psc')
      .leftJoinAndSelect('psc.category', 'shopCat')
      .andWhere('p.slug = :slug', { slug })
      .getOne();

    if (!post) throw new NotFoundException('مقاله پیدا نشد.');

    const coverUuid = post.featuredImageFile?.uuid || null;
    const ogUuid = post.ogImageFile?.uuid || coverUuid;
    const categories =
      post.categoryRelations
        ?.map((r) => r.category)
        .filter(Boolean)
        .map((c: PostCategory) => ({
          uuid: c.uuid,
          name: c.name,
          slug: c.slug,
        })) || [];
    const tags =
      post.tagRelations
        ?.map((r) => r.tag)
        .filter(Boolean)
        .map((t: PostTag) => ({
          uuid: t.uuid,
          name: t.name,
          slug: t.slug,
        })) || [];

    const products = (post.postProducts || [])
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((pp) => {
        const p = pp.product as Product | undefined;
        if (!p || p.status !== ProductStatus.ACTIVE) return null;
        const imgs = ((p as any).images || []) as ProductImage[];
        const primary =
          imgs.find((i) => i.isPrimary) ||
          [...imgs].sort(
            (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
          )[0];
        const fileUuid = (primary as any)?.file?.uuid || null;

        let price: number | null = null;
        let compareAtPrice: number | null = null;
        for (const v of (p as any).variants || []) {
          const active =
            (v.prices || []).find((pr: any) => pr.isActive) || v.prices?.[0];
          if (!active) continue;
          const amount = Number(active.amount);
          if (Number.isNaN(amount)) continue;
          if (price === null || amount < price) {
            price = amount;
            compareAtPrice = active.compareAtAmount
              ? Number(active.compareAtAmount)
              : null;
          }
        }
        let discountPercent: number | null = null;
        if (
          price != null &&
          compareAtPrice != null &&
          compareAtPrice > price
        ) {
          discountPercent = Math.round(
            ((compareAtPrice - price) / compareAtPrice) * 100,
          );
        }

        return {
          uuid: p.uuid,
          publicId: p.publicId,
          title: p.name,
          name: p.name,
          slug: p.slug,
          shortDescription: p.shortDescription || null,
          imageUrl: fileUuid ? this.mediaPath(fileUuid) : null,
          price,
          compareAtPrice,
          discountPercent,
          isAmazing: Boolean(p.isAmazing),
        };
      })
      .filter(Boolean);

    // Linked storefront categories → auto product shelves
    const shopCatRels = (post.postShopCategories || [])
      .slice()
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const shopCategories: Array<{
      uuid: string;
      title: string;
      slug: string;
      publicId: string | null;
      products: any[];
    }> = [];
    for (const rel of shopCatRels) {
      const c = rel.category;
      if (!c?.slug) continue;
      try {
        const listed = await this.storefront.listProducts({
          categorySlug: c.slug,
          page: 1,
          limit: 10,
          sort: 'newest',
        });
        shopCategories.push({
          uuid: c.uuid,
          title: c.title,
          slug: c.slug,
          publicId: c.publicId || null,
          products: listed.data || [],
        });
      } catch {
        shopCategories.push({
          uuid: c.uuid,
          title: c.title,
          slug: c.slug,
          publicId: c.publicId || null,
          products: [],
        });
      }
    }

    // Related: same category, exclude self
    let related: ReturnType<PublicMagService['cardFromPost']>[] = [];
    const catIds = (post.categoryRelations || [])
      .map((r) => r.categoryId)
      .filter(Boolean);
    if (catIds.length) {
      const relatedRows = await this.publishedQb('p')
        .leftJoinAndSelect('p.author', 'author')
        .leftJoinAndSelect('p.featuredImageFile', 'cover')
        .leftJoinAndSelect('p.categoryRelations', 'cr')
        .leftJoinAndSelect('cr.category', 'cat')
        .andWhere('p.id != :id', { id: post.id })
        .andWhere('cr.categoryId IN (:...cids)', { cids: catIds })
        .orderBy('p.publishedAt', 'DESC')
        .take(4)
        .getMany();
      related = relatedRows.map((p) => this.cardFromPost(p));
    }

    return {
      success: true,
      data: {
        uuid: post.uuid,
        title: post.title,
        slug: post.slug,
        content: sanitizeBlogHtml(post.content),
        excerpt: post.excerpt,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        readingTimeMinutes: post.readingTimeMinutes || 1,
        isFeatured: Boolean(post.isFeatured),
        metaTitle: post.metaTitle || post.title,
        metaDescription: post.metaDescription || post.excerpt,
        metaKeywords: post.metaKeywords,
        canonicalUrl: post.canonicalUrl,
        featuredImageAlt: post.featuredImageAlt || post.title,
        featuredImageUrl: this.mediaPath(coverUuid),
        ogImageUrl: this.mediaPath(ogUuid),
        author: post.author
          ? {
              firstName: post.author.firstName,
              lastName: post.author.lastName,
            }
          : null,
        categories,
        tags,
        products,
        shopCategories,
        related,
      },
    };
  }

  async listCategories() {
    const rows = await this.categoryRepo.find({
      relations: ['imageFile'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return {
      success: true,
      data: rows.map((c) => ({
        uuid: c.uuid,
        name: c.name,
        slug: c.slug,
        description: c.description,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        imageUrl: this.mediaPath(c.imageFile?.uuid),
      })),
    };
  }

  async listTags() {
    const rows = await this.tagRepo.find({
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return {
      success: true,
      data: rows.map((t) => ({
        uuid: t.uuid,
        name: t.name,
        slug: t.slug,
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
      })),
    };
  }

  async listSlugsForSitemap() {
    const rows = await this.publishedQb('p')
      .select(['p.slug', 'p.updatedAt', 'p.publishedAt'])
      .orderBy('p.publishedAt', 'DESC')
      .getMany();
    return rows.map((p) => ({
      slug: p.slug,
      updatedAt: p.updatedAt || p.publishedAt,
    }));
  }
}
