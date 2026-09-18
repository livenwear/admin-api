import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  estimateReadingMinutes,
  sanitizeBlogHtml,
} from 'src/common/utils/blog-html';
import { slugify } from 'src/common/utils/slugify';
import {
  Category,
  FileEntity,
  Post,
  PostCategory,
  PostCategoryRelation,
  PostProduct,
  PostShopCategory,
  PostStatus,
  PostTag,
  PostTagRelation,
  Product,
  User,
} from 'src/entities';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import {
  AdminBlogListQueryDto,
  AdminBlogPostDto,
  AdminBlogTaxonomyDto,
  AdminUpdateBlogPostDto,
  AdminUpdateBlogTaxonomyDto,
} from './dto/blog.dto';

@Injectable()
export class AdminBlogService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(PostCategory)
    private readonly categoryRepo: Repository<PostCategory>,
    @InjectRepository(PostTag)
    private readonly tagRepo: Repository<PostTag>,
    @InjectRepository(PostCategoryRelation)
    private readonly catRelRepo: Repository<PostCategoryRelation>,
    @InjectRepository(PostTagRelation)
    private readonly tagRelRepo: Repository<PostTagRelation>,
    @InjectRepository(PostProduct)
    private readonly postProductRepo: Repository<PostProduct>,
    @InjectRepository(PostShopCategory)
    private readonly postShopCategoryRepo: Repository<PostShopCategory>,
    @InjectRepository(Category)
    private readonly shopCategoryRepo: Repository<Category>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly storageService: StorageService,
  ) {}

  private mediaPath(uuid?: string | null) {
    return uuid ? `/public/media/${uuid}` : null;
  }

  private async resolveFile(
    uuid: string | null | undefined,
    allowed: StorageNamespace[],
  ) {
    if (!uuid) return null;
    const file = await this.fileRepo.findOne({ where: { uuid } });
    if (!file || !allowed.includes(file.namespace as StorageNamespace)) {
      throw new BadRequestException('فایل رسانه معتبر نیست.');
    }
    return file;
  }

  private async uniquePostSlug(base: string, excludeId?: number) {
    let slug = slugify(base) || `post-${Date.now()}`;
    let n = 0;
    while (true) {
      const candidate = n === 0 ? slug : `${slug}-${n}`;
      const existing = await this.postRepo.findOne({
        where: { slug: candidate },
        withDeleted: true,
      });
      if (!existing || (excludeId && existing.id === excludeId)) {
        return candidate;
      }
      n += 1;
    }
  }

  private async uniqueTaxonomySlug(
    repo: Repository<PostCategory | PostTag>,
    base: string,
    excludeId?: number,
  ) {
    let slug = slugify(base) || `item-${Date.now()}`;
    let n = 0;
    while (true) {
      const candidate = n === 0 ? slug : `${slug}-${n}`;
      const existing = await repo.findOne({
        where: { slug: candidate } as any,
        withDeleted: true,
      });
      if (!existing || (excludeId && existing.id === excludeId)) {
        return candidate;
      }
      n += 1;
    }
  }

  private async mapPost(post: Post) {
    const coverUuid = post.featuredImageFile?.uuid || null;
    const ogUuid = post.ogImageFile?.uuid || coverUuid;
    let coverAccess: string | null = null;
    if (post.featuredImageFile?.bucket && post.featuredImageFile?.objectKey) {
      try {
        coverAccess = await this.storageService.getPresignedUrl(
          post.featuredImageFile.bucket,
          post.featuredImageFile.objectKey,
          3600,
        );
      } catch {
        coverAccess = null;
      }
    }

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

    const products =
      (post.postProducts || [])
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .map((pp) => {
          const p = pp.product as Product | undefined;
          if (!p) return null;
          return {
            uuid: p.uuid,
            title: p.name,
            slug: p.slug,
          };
        })
        .filter(Boolean) || [];

    const shopCategories =
      (post.postShopCategories || [])
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .map((sc) => {
          const c = sc.category as Category | undefined;
          if (!c) return null;
          return {
            uuid: c.uuid,
            title: c.title,
            slug: c.slug,
            publicId: c.publicId,
          };
        })
        .filter(Boolean) || [];

    return {
      uuid: post.uuid,
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt,
      status: post.status,
      publishedAt: post.publishedAt,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      metaKeywords: post.metaKeywords,
      canonicalUrl: post.canonicalUrl,
      readingTimeMinutes: post.readingTimeMinutes || 1,
      isFeatured: Boolean(post.isFeatured),
      featuredImageAlt: post.featuredImageAlt,
      featuredImageUuid: coverUuid,
      featuredImageUrl: this.mediaPath(coverUuid),
      featuredImageAccessUrl: coverAccess,
      ogImageUuid: post.ogImageFile?.uuid || null,
      ogImageUrl: this.mediaPath(ogUuid),
      author: post.author
        ? {
            uuid: post.author.uuid,
            firstName: post.author.firstName,
            lastName: post.author.lastName,
          }
        : null,
      categories,
      tags,
      products,
      shopCategories,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private postRelations() {
    return [
      'author',
      'featuredImageFile',
      'ogImageFile',
      'categoryRelations',
      'categoryRelations.category',
      'tagRelations',
      'tagRelations.tag',
      'postProducts',
      'postProducts.product',
      'postShopCategories',
      'postShopCategories.category',
    ];
  }

  async listPosts(query: AdminBlogListQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const qb = this.postRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.author', 'author')
      .leftJoinAndSelect('p.featuredImageFile', 'cover')
      .orderBy('p.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.q?.trim()) {
      qb.andWhere(
        '(p.title ILIKE :q OR p.slug ILIKE :q OR p.excerpt ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }
    if (query.categoryUuid) {
      qb.innerJoin('p.categoryRelations', 'cr')
        .innerJoin('cr.category', 'cat')
        .andWhere('cat.uuid = :cUuid', { cUuid: query.categoryUuid });
    }
    if (query.tagUuid) {
      qb.innerJoin('p.tagRelations', 'tr')
        .innerJoin('tr.tag', 'tag')
        .andWhere('tag.uuid = :tUuid', { tUuid: query.tagUuid });
    }

    const [rows, total] = await qb.getManyAndCount();
    const data = await Promise.all(rows.map((p) => this.mapPost(p)));
    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getPost(uuid: string) {
    const post = await this.postRepo.findOne({
      where: { uuid },
      relations: this.postRelations(),
    });
    if (!post) throw new NotFoundException('مقاله پیدا نشد.');
    return { success: true, data: await this.mapPost(post) };
  }

  private async syncRelations(
    post: Post,
    categoryUuids?: string[],
    tagUuids?: string[],
    productUuids?: string[],
    shopCategoryUuids?: string[],
  ) {
    if (categoryUuids) {
      await this.catRelRepo.delete({ postId: post.id });
      if (categoryUuids.length) {
        const cats = await this.categoryRepo.find({
          where: { uuid: In(categoryUuids) },
        });
        await this.catRelRepo.save(
          cats.map((c) =>
            this.catRelRepo.create({ postId: post.id, categoryId: c.id }),
          ),
        );
      }
    }
    if (tagUuids) {
      await this.tagRelRepo.delete({ postId: post.id });
      if (tagUuids.length) {
        const tags = await this.tagRepo.find({
          where: { uuid: In(tagUuids) },
        });
        await this.tagRelRepo.save(
          tags.map((t) =>
            this.tagRelRepo.create({ postId: post.id, tagId: t.id }),
          ),
        );
      }
    }
    if (productUuids) {
      await this.postProductRepo.delete({ postId: post.id });
      if (productUuids.length) {
        const products = await this.productRepo.find({
          where: { uuid: In(productUuids.slice(0, 24)) },
        });
        const byUuid = new Map(products.map((p) => [p.uuid, p]));
        const ordered = productUuids
          .map((u) => byUuid.get(u))
          .filter(Boolean) as Product[];
        await this.postProductRepo.save(
          ordered.map((p, i) =>
            this.postProductRepo.create({
              postId: post.id,
              productId: p.id,
              displayOrder: i,
            }),
          ),
        );
      }
    }
    if (shopCategoryUuids) {
      await this.postShopCategoryRepo.delete({ postId: post.id });
      if (shopCategoryUuids.length) {
        const cats = await this.shopCategoryRepo.find({
          where: { uuid: In(shopCategoryUuids.slice(0, 12)) },
        });
        const byUuid = new Map(cats.map((c) => [c.uuid, c]));
        const ordered = shopCategoryUuids
          .map((u) => byUuid.get(u))
          .filter(Boolean) as Category[];
        await this.postShopCategoryRepo.save(
          ordered.map((c, i) =>
            this.postShopCategoryRepo.create({
              postId: post.id,
              categoryId: c.id,
              displayOrder: i,
            }),
          ),
        );
      }
    }
  }

  async createPost(dto: AdminBlogPostDto, author: User) {
    const content = sanitizeBlogHtml(dto.content);
    if (!content) throw new BadRequestException('محتوای مقاله الزامی است.');

    const status = dto.status || PostStatus.DRAFT;
    const slug = await this.uniquePostSlug(dto.slug || dto.title);
    const cover = await this.resolveFile(dto.featuredImageUuid, [
      StorageNamespace.BLOG,
    ]);
    const og = await this.resolveFile(dto.ogImageUuid, [StorageNamespace.BLOG]);

    let publishedAt: Date | null = null;
    if (status === PostStatus.PUBLISHED) {
      publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : new Date();
    } else if (dto.publishedAt) {
      publishedAt = new Date(dto.publishedAt);
    }

    const post = await this.postRepo.save(
      this.postRepo.create({
        title: dto.title.trim(),
        slug,
        content,
        excerpt: dto.excerpt?.trim() || null,
        status,
        publishedAt,
        author,
        authorId: author.id,
        featuredImageFile: cover,
        featuredImageId: cover?.id ?? null,
        featuredImage: cover ? this.mediaPath(cover.uuid) : null,
        featuredImageAlt: dto.featuredImageAlt?.trim() || null,
        ogImageFile: og,
        ogImageId: og?.id ?? null,
        metaTitle: dto.metaTitle?.trim() || null,
        metaDescription: dto.metaDescription?.trim() || null,
        metaKeywords: dto.metaKeywords?.trim() || null,
        canonicalUrl: dto.canonicalUrl?.trim() || null,
        isFeatured: Boolean(dto.isFeatured),
        readingTimeMinutes: estimateReadingMinutes(content),
      }),
    );

    await this.syncRelations(
      post,
      dto.categoryUuids,
      dto.tagUuids,
      dto.productUuids,
      dto.shopCategoryUuids,
    );

    return this.getPost(post.uuid);
  }

  async updatePost(uuid: string, dto: AdminUpdateBlogPostDto) {
    const post = await this.postRepo.findOne({
      where: { uuid },
      relations: this.postRelations(),
    });
    if (!post) throw new NotFoundException('مقاله پیدا نشد.');

    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.slug !== undefined || dto.title !== undefined) {
      post.slug = await this.uniquePostSlug(
        dto.slug || dto.title || post.title,
        post.id,
      );
    }
    if (dto.content !== undefined) {
      const content = sanitizeBlogHtml(dto.content);
      if (!content) throw new BadRequestException('محتوای مقاله الزامی است.');
      post.content = content;
      post.readingTimeMinutes = estimateReadingMinutes(content);
    }
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt?.trim() || null;
    if (dto.metaTitle !== undefined)
      post.metaTitle = dto.metaTitle?.trim() || null;
    if (dto.metaDescription !== undefined)
      post.metaDescription = dto.metaDescription?.trim() || null;
    if (dto.metaKeywords !== undefined)
      post.metaKeywords = dto.metaKeywords?.trim() || null;
    if (dto.canonicalUrl !== undefined)
      post.canonicalUrl = dto.canonicalUrl?.trim() || null;
    if (dto.featuredImageAlt !== undefined)
      post.featuredImageAlt = dto.featuredImageAlt?.trim() || null;
    if (dto.isFeatured !== undefined) post.isFeatured = Boolean(dto.isFeatured);

    if (dto.featuredImageUuid !== undefined) {
      const cover = await this.resolveFile(dto.featuredImageUuid, [
        StorageNamespace.BLOG,
      ]);
      post.featuredImageFile = cover;
      post.featuredImageId = cover?.id ?? null;
      post.featuredImage = cover ? this.mediaPath(cover.uuid) : null;
    }
    if (dto.ogImageUuid !== undefined) {
      const og = await this.resolveFile(dto.ogImageUuid, [
        StorageNamespace.BLOG,
      ]);
      post.ogImageFile = og;
      post.ogImageId = og?.id ?? null;
    }

    if (dto.status !== undefined) {
      post.status = dto.status;
      if (
        dto.status === PostStatus.PUBLISHED &&
        !post.publishedAt &&
        !dto.publishedAt
      ) {
        post.publishedAt = new Date();
      }
    }
    if (dto.publishedAt !== undefined) {
      post.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }

    await this.postRepo.save(post);
    await this.syncRelations(
      post,
      dto.categoryUuids,
      dto.tagUuids,
      dto.productUuids,
      dto.shopCategoryUuids,
    );
    return this.getPost(uuid);
  }

  async deletePost(uuid: string) {
    const post = await this.postRepo.findOne({ where: { uuid } });
    if (!post) throw new NotFoundException('مقاله پیدا نشد.');
    await this.postRepo.softRemove(post);
    return { success: true };
  }

  // ─── Categories ─────────────────────────────────────────────

  private mapCategory(c: PostCategory) {
    return {
      uuid: c.uuid,
      name: c.name,
      slug: c.slug,
      description: c.description,
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      displayOrder: c.displayOrder || 0,
      imageUuid: c.imageFile?.uuid || null,
      imageUrl: this.mediaPath(c.imageFile?.uuid),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  async listCategories() {
    const rows = await this.categoryRepo.find({
      relations: ['imageFile'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return { success: true, data: rows.map((c) => this.mapCategory(c)) };
  }

  async createCategory(dto: AdminBlogTaxonomyDto) {
    const slug = await this.uniqueTaxonomySlug(
      this.categoryRepo,
      dto.slug || dto.name,
    );
    const image = await this.resolveFile(dto.imageUuid, [
      StorageNamespace.BLOG_CATEGORIES,
      StorageNamespace.BLOG,
    ]);
    const row = await this.categoryRepo.save(
      this.categoryRepo.create({
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        metaTitle: dto.metaTitle?.trim() || null,
        metaDescription: dto.metaDescription?.trim() || null,
        displayOrder: dto.displayOrder ?? 0,
        imageFile: image,
        imageId: image?.id ?? null,
      }),
    );
    const full = await this.categoryRepo.findOne({
      where: { id: row.id },
      relations: ['imageFile'],
    });
    return { success: true, data: this.mapCategory(full!) };
  }

  async updateCategory(uuid: string, dto: AdminUpdateBlogTaxonomyDto) {
    const row = await this.categoryRepo.findOne({
      where: { uuid },
      relations: ['imageFile'],
    });
    if (!row) throw new NotFoundException('دسته‌بندی پیدا نشد.');
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.slug !== undefined || dto.name !== undefined) {
      row.slug = await this.uniqueTaxonomySlug(
        this.categoryRepo,
        dto.slug || dto.name || row.name,
        row.id,
      );
    }
    if (dto.description !== undefined)
      row.description = dto.description?.trim() || null;
    if (dto.metaTitle !== undefined)
      row.metaTitle = dto.metaTitle?.trim() || null;
    if (dto.metaDescription !== undefined)
      row.metaDescription = dto.metaDescription?.trim() || null;
    if (dto.displayOrder !== undefined) row.displayOrder = dto.displayOrder;
    if (dto.imageUuid !== undefined) {
      const image = await this.resolveFile(dto.imageUuid, [
        StorageNamespace.BLOG_CATEGORIES,
        StorageNamespace.BLOG,
      ]);
      row.imageFile = image;
      row.imageId = image?.id ?? null;
    }
    await this.categoryRepo.save(row);
    const full = await this.categoryRepo.findOne({
      where: { id: row.id },
      relations: ['imageFile'],
    });
    return { success: true, data: this.mapCategory(full!) };
  }

  async deleteCategory(uuid: string) {
    const row = await this.categoryRepo.findOne({ where: { uuid } });
    if (!row) throw new NotFoundException('دسته‌بندی پیدا نشد.');
    await this.categoryRepo.softRemove(row);
    return { success: true };
  }

  // ─── Tags ───────────────────────────────────────────────────

  private mapTag(t: PostTag) {
    return {
      uuid: t.uuid,
      name: t.name,
      slug: t.slug,
      metaTitle: t.metaTitle,
      metaDescription: t.metaDescription,
      displayOrder: t.displayOrder || 0,
      imageUuid: t.imageFile?.uuid || null,
      imageUrl: this.mediaPath(t.imageFile?.uuid),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async listTags() {
    const rows = await this.tagRepo.find({
      relations: ['imageFile'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return { success: true, data: rows.map((t) => this.mapTag(t)) };
  }

  async createTag(dto: AdminBlogTaxonomyDto) {
    const slug = await this.uniqueTaxonomySlug(
      this.tagRepo,
      dto.slug || dto.name,
    );
    const image = await this.resolveFile(dto.imageUuid, [
      StorageNamespace.BLOG_TAGS,
      StorageNamespace.BLOG,
    ]);
    const row = await this.tagRepo.save(
      this.tagRepo.create({
        name: dto.name.trim(),
        slug,
        metaTitle: dto.metaTitle?.trim() || null,
        metaDescription: dto.metaDescription?.trim() || null,
        displayOrder: dto.displayOrder ?? 0,
        imageFile: image,
        imageId: image?.id ?? null,
      }),
    );
    const full = await this.tagRepo.findOne({
      where: { id: row.id },
      relations: ['imageFile'],
    });
    return { success: true, data: this.mapTag(full!) };
  }

  async updateTag(uuid: string, dto: AdminUpdateBlogTaxonomyDto) {
    const row = await this.tagRepo.findOne({
      where: { uuid },
      relations: ['imageFile'],
    });
    if (!row) throw new NotFoundException('برچسب پیدا نشد.');
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.slug !== undefined || dto.name !== undefined) {
      row.slug = await this.uniqueTaxonomySlug(
        this.tagRepo,
        dto.slug || dto.name || row.name,
        row.id,
      );
    }
    if (dto.metaTitle !== undefined)
      row.metaTitle = dto.metaTitle?.trim() || null;
    if (dto.metaDescription !== undefined)
      row.metaDescription = dto.metaDescription?.trim() || null;
    if (dto.displayOrder !== undefined) row.displayOrder = dto.displayOrder;
    if (dto.imageUuid !== undefined) {
      const image = await this.resolveFile(dto.imageUuid, [
        StorageNamespace.BLOG_TAGS,
        StorageNamespace.BLOG,
      ]);
      row.imageFile = image;
      row.imageId = image?.id ?? null;
    }
    await this.tagRepo.save(row);
    const full = await this.tagRepo.findOne({
      where: { id: row.id },
      relations: ['imageFile'],
    });
    return { success: true, data: this.mapTag(full!) };
  }

  async deleteTag(uuid: string) {
    const row = await this.tagRepo.findOne({ where: { uuid } });
    if (!row) throw new NotFoundException('برچسب پیدا نشد.');
    await this.tagRepo.softRemove(row);
    return { success: true };
  }
}
