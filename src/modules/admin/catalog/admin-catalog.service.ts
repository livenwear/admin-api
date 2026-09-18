import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { generateCategoryPublicId } from 'src/common/utils/category-public-id';
import { isSvgMime, isRasterImageMime } from 'src/common/utils/svg-upload';
import { slugify } from 'src/common/utils/slugify';
import {
  Attribute,
  AttributeType,
  AttributeValue,
  Brand,
  Category,
  Collection,
  FileEntity,
  ProductCategory,
  Tag,
} from 'src/entities';
import { StorageNamespace } from 'src/storage/storage.constants';
import { Brackets, Repository } from 'typeorm';
import {
  AdminAttributeDto,
  AdminAttributeValueDto,
  AdminBrandDto,
  AdminCategoryDto,
  AdminCollectionDto,
  AdminTagDto,
  AdminUpdateAttributeDto,
  AdminUpdateAttributeValueDto,
  AdminUpdateBrandDto,
  AdminUpdateCategoryDto,
  AdminUpdateCollectionDto,
  AdminUpdateTagDto,
  CatalogListQueryDto,
} from './dto/catalog.dto';

@Injectable()
export class AdminCatalogService {
  constructor(
    @InjectRepository(Brand) private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Attribute)
    private readonly attributeRepo: Repository<Attribute>,
    @InjectRepository(AttributeValue)
    private readonly attributeValueRepo: Repository<AttributeValue>,
    @InjectRepository(Tag) private readonly tagRepo: Repository<Tag>,
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepo: Repository<ProductCategory>,
  ) {}

  // ── Brands ─────────────────────────────────────────────
  async listBrands(query: CatalogListQueryDto) {
    return this.paginated(
      this.brandRepo.createQueryBuilder('b'),
      query,
      ['b.name', 'b.slug'],
      (rows) => rows.map((b) => this.mapBrand(b)),
    );
  }

  async createBrand(dto: AdminBrandDto) {
    const slug = await this.uniqueBrandSlug(dto.slug || dto.name);
    const logoUrl = await this.resolveFileMarker(dto.logoFileUuid);
    const brand = await this.brandRepo.save(
      this.brandRepo.create({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        logoUrl,
        isActive: dto.isActive ?? true,
      }),
    );
    return { success: true, data: this.mapBrand(brand) };
  }

  async updateBrand(uuid: string, dto: AdminUpdateBrandDto) {
    const brand = await this.brandRepo.findOne({ where: { uuid } });
    if (!brand) throw new NotFoundException('Brand not found.');
    if (dto.name !== undefined) brand.name = dto.name;
    if (dto.slug !== undefined)
      brand.slug = await this.uniqueBrandSlug(dto.slug, brand.id);
    if (dto.description !== undefined) brand.description = dto.description;
    if (dto.isActive !== undefined) brand.isActive = dto.isActive;
    if (dto.logoFileUuid !== undefined)
      brand.logoUrl = await this.resolveFileMarker(dto.logoFileUuid);
    await this.brandRepo.save(brand);
    return { success: true, data: this.mapBrand(brand) };
  }

  async deleteBrand(uuid: string) {
    const brand = await this.brandRepo.findOne({ where: { uuid } });
    if (!brand) throw new NotFoundException('Brand not found.');
    await this.brandRepo.softRemove(brand);
    return { success: true, message: 'Brand deleted' };
  }

  // ── Categories ─────────────────────────────────────────
  async listCategories(query: CatalogListQueryDto) {
    const qb = this.categoryRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.parent', 'parent')
      .orderBy('c.displayOrder', 'ASC')
      .addOrderBy('c.createdAt', 'DESC');

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('c.title ILIKE :term', { term }).orWhere(
            'c.slug ILIKE :term',
            { term },
          );
        }),
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const total = await qb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const data = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    const countMap = new Map<number, number>();
    if (data.length) {
      const rows = await this.productCategoryRepo
        .createQueryBuilder('pc')
        .select('pc.categoryId', 'categoryId')
        .addSelect('COUNT(DISTINCT pc.productId)', 'cnt')
        .where('pc.categoryId IN (:...ids)', {
          ids: data.map((c) => c.id),
        })
        .groupBy('pc.categoryId')
        .getRawMany<{ categoryId: string; cnt: string }>();
      for (const row of rows) {
        countMap.set(Number(row.categoryId), Number(row.cnt) || 0);
      }
    }

    return {
      success: true,
      data: data.map((c) =>
        this.mapCategory(c, countMap.get(c.id) ?? 0),
      ),
      meta: this.meta(safePage, limit, total, totalPages),
    };
  }

  async createCategory(dto: AdminCategoryDto) {
    const slug = await this.uniqueCategorySlug(dto.slug || dto.title);
    const parent = dto.parentUuid
      ? await this.categoryRepo.findOne({ where: { uuid: dto.parentUuid } })
      : null;
    if (dto.parentUuid && !parent)
      throw new NotFoundException('Parent category not found.');

    const imageUrl = await this.resolveCategoryLogoMarker(dto.imageFileUuid);
    const coverImageUrl = await this.resolveCategoryCoverMarker(
      dto.coverImageFileUuid,
    );
    const category = await this.categoryRepo.save(
      this.categoryRepo.create({
        title: dto.title,
        slug,
        publicId: await this.uniqueCategoryPublicId(),
        description: dto.description ?? null,
        parent: parent || null,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
        imageUrl,
        coverImageUrl,
      }),
    );
    return { success: true, data: this.mapCategory(category) };
  }

  async updateCategory(uuid: string, dto: AdminUpdateCategoryDto) {
    const category = await this.categoryRepo.findOne({
      where: { uuid },
      relations: ['parent'],
    });
    if (!category) throw new NotFoundException('Category not found.');

    if (dto.title !== undefined) category.title = dto.title;
    if (dto.slug !== undefined)
      category.slug = await this.uniqueCategorySlug(dto.slug, category.id);
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.metaTitle !== undefined) category.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined)
      category.metaDescription = dto.metaDescription;
    if (dto.displayOrder !== undefined)
      category.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    if (dto.imageFileUuid !== undefined)
      category.imageUrl = await this.resolveCategoryLogoMarker(
        dto.imageFileUuid,
      );
    if (dto.coverImageFileUuid !== undefined)
      category.coverImageUrl = await this.resolveCategoryCoverMarker(
        dto.coverImageFileUuid,
      );
    if (dto.parentUuid !== undefined) {
      if (!dto.parentUuid) category.parent = null;
      else {
        const parent = await this.categoryRepo.findOne({
          where: { uuid: dto.parentUuid },
        });
        if (!parent) throw new NotFoundException('Parent category not found.');
        if (parent.id === category.id)
          throw new ConflictException('Category cannot be its own parent.');
        category.parent = parent;
      }
    }

    await this.categoryRepo.save(category);
    return { success: true, data: this.mapCategory(category) };
  }

  async deleteCategory(uuid: string) {
    const category = await this.categoryRepo.findOne({ where: { uuid } });
    if (!category) throw new NotFoundException('Category not found.');
    await this.categoryRepo.softRemove(category);
    return { success: true, message: 'Category deleted' };
  }

  // ── Attributes ─────────────────────────────────────────
  async listAttributes() {
    const rows = await this.attributeRepo.find({
      relations: ['values'],
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });
    return {
      success: true,
      data: rows.map((a) => this.mapAttribute(a)),
    };
  }

  async createAttribute(dto: AdminAttributeDto) {
    const slug = await this.uniqueAttributeSlug(dto.slug || dto.name);
    const type = (dto.type as AttributeType) || AttributeType.SELECT;
    // Text-style attributes are informational by default (not PDP pickers)
    const isCustomerSelectable =
      dto.isCustomerSelectable ??
      (type === AttributeType.TEXT ? false : true);
    const attr = await this.attributeRepo.save(
      this.attributeRepo.create({
        name: dto.name,
        slug,
        type,
        displayOrder: dto.displayOrder ?? 0,
        isFilterable: dto.isFilterable ?? true,
        isVisible: dto.isVisible ?? true,
        isCustomerSelectable,
      }),
    );
    return { success: true, data: this.mapAttribute(attr) };
  }

  async updateAttribute(uuid: string, dto: AdminUpdateAttributeDto) {
    const attr = await this.attributeRepo.findOne({
      where: { uuid },
      relations: ['values'],
    });
    if (!attr) throw new NotFoundException('Attribute not found.');
    if (dto.name !== undefined) attr.name = dto.name;
    if (dto.slug !== undefined)
      attr.slug = await this.uniqueAttributeSlug(dto.slug, attr.id);
    if (dto.type !== undefined) attr.type = dto.type as AttributeType;
    if (dto.displayOrder !== undefined) attr.displayOrder = dto.displayOrder;
    if (dto.isFilterable !== undefined) attr.isFilterable = dto.isFilterable;
    if (dto.isVisible !== undefined) attr.isVisible = dto.isVisible;
    if (dto.isCustomerSelectable !== undefined)
      attr.isCustomerSelectable = dto.isCustomerSelectable;
    await this.attributeRepo.save(attr);
    return { success: true, data: this.mapAttribute(attr) };
  }

  async deleteAttribute(uuid: string) {
    const attr = await this.attributeRepo.findOne({ where: { uuid } });
    if (!attr) throw new NotFoundException('Attribute not found.');
    await this.attributeRepo.softRemove(attr);
    return { success: true, message: 'Attribute deleted' };
  }

  async addAttributeValue(attributeUuid: string, dto: AdminAttributeValueDto) {
    const attr = await this.attributeRepo.findOne({
      where: { uuid: attributeUuid },
    });
    if (!attr) throw new NotFoundException('Attribute not found.');
    const slug = slugify(dto.slug || dto.value) || `val-${Date.now()}`;
    const value = await this.attributeValueRepo.save(
      this.attributeValueRepo.create({
        attribute: attr,
        value: dto.value,
        slug,
        colorCode: dto.colorCode ?? null,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
    return {
      success: true,
      data: {
        uuid: value.uuid,
        value: value.value,
        slug: value.slug,
        colorCode: value.colorCode,
        displayOrder: value.displayOrder,
      },
    };
  }

  async updateAttributeValue(
    valueUuid: string,
    dto: AdminUpdateAttributeValueDto,
  ) {
    const value = await this.attributeValueRepo.findOne({
      where: { uuid: valueUuid },
    });
    if (!value) throw new NotFoundException('Attribute value not found.');
    if (dto.value !== undefined) value.value = dto.value;
    if (dto.slug !== undefined) value.slug = slugify(dto.slug);
    if (dto.colorCode !== undefined) value.colorCode = dto.colorCode;
    if (dto.displayOrder !== undefined) value.displayOrder = dto.displayOrder;
    await this.attributeValueRepo.save(value);
    return {
      success: true,
      data: {
        uuid: value.uuid,
        value: value.value,
        slug: value.slug,
        colorCode: value.colorCode,
        displayOrder: value.displayOrder,
      },
    };
  }

  async deleteAttributeValue(valueUuid: string) {
    const value = await this.attributeValueRepo.findOne({
      where: { uuid: valueUuid },
    });
    if (!value) throw new NotFoundException('Attribute value not found.');
    await this.attributeValueRepo.softRemove(value);
    return { success: true, message: 'Attribute value deleted' };
  }

  // ── Tags ───────────────────────────────────────────────
  async listTags(query: CatalogListQueryDto) {
    const qb = this.tagRepo.createQueryBuilder('t');
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('t.name ILIKE :term', { term }).orWhere('t.slug ILIKE :term', {
            term,
          });
        }),
      );
    }
    qb.orderBy('t.createdAt', 'DESC');
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const total = await qb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();
    return {
      success: true,
      data: rows.map((t) => ({
        uuid: t.uuid,
        name: t.name,
        slug: t.slug,
        createdAt: t.createdAt,
      })),
      meta: this.meta(safePage, limit, total, totalPages),
    };
  }

  async createTag(dto: AdminTagDto) {
    const slug = await this.uniqueSlug(
      this.tagRepo,
      'slug',
      dto.slug || dto.name,
    );
    const tag = await this.tagRepo.save(
      this.tagRepo.create({ name: dto.name, slug }),
    );
    return {
      success: true,
      data: { uuid: tag.uuid, name: tag.name, slug: tag.slug },
    };
  }

  async updateTag(uuid: string, dto: AdminUpdateTagDto) {
    const tag = await this.tagRepo.findOne({ where: { uuid } });
    if (!tag) throw new NotFoundException('Tag not found.');
    if (dto.name !== undefined) tag.name = dto.name;
    if (dto.slug !== undefined)
      tag.slug = await this.uniqueSlug(this.tagRepo, 'slug', dto.slug, tag.id);
    await this.tagRepo.save(tag);
    return {
      success: true,
      data: { uuid: tag.uuid, name: tag.name, slug: tag.slug },
    };
  }

  async deleteTag(uuid: string) {
    const tag = await this.tagRepo.findOne({ where: { uuid } });
    if (!tag) throw new NotFoundException('Tag not found.');
    await this.tagRepo.softRemove(tag);
    return { success: true, message: 'Tag deleted' };
  }

  // ── Collections ────────────────────────────────────────
  async listCollections(query: CatalogListQueryDto) {
    const qb = this.collectionRepo.createQueryBuilder('c');
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('c.name ILIKE :term', { term }).orWhere('c.slug ILIKE :term', {
            term,
          });
        }),
      );
    }
    qb.orderBy('c.createdAt', 'DESC');
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const total = await qb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();
    return {
      success: true,
      data: rows.map((c) => this.mapCollection(c)),
      meta: this.meta(safePage, limit, total, totalPages),
    };
  }

  async createCollection(dto: AdminCollectionDto) {
    const slug = await this.uniqueSlug(
      this.collectionRepo,
      'slug',
      dto.slug || dto.name,
    );
    const collection = await this.collectionRepo.save(
      this.collectionRepo.create({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        imageUrl: await this.resolveFileMarker(dto.imageFileUuid),
        isActive: dto.isActive ?? true,
      }),
    );
    return { success: true, data: this.mapCollection(collection) };
  }

  async updateCollection(uuid: string, dto: AdminUpdateCollectionDto) {
    const collection = await this.collectionRepo.findOne({ where: { uuid } });
    if (!collection) throw new NotFoundException('Collection not found.');
    if (dto.name !== undefined) collection.name = dto.name;
    if (dto.slug !== undefined)
      collection.slug = await this.uniqueSlug(
        this.collectionRepo,
        'slug',
        dto.slug,
        collection.id,
      );
    if (dto.description !== undefined)
      collection.description = dto.description;
    if (dto.isActive !== undefined) collection.isActive = dto.isActive;
    if (dto.imageFileUuid !== undefined)
      collection.imageUrl = await this.resolveFileMarker(dto.imageFileUuid);
    await this.collectionRepo.save(collection);
    return { success: true, data: this.mapCollection(collection) };
  }

  async deleteCollection(uuid: string) {
    const collection = await this.collectionRepo.findOne({ where: { uuid } });
    if (!collection) throw new NotFoundException('Collection not found.');
    await this.collectionRepo.softRemove(collection);
    return { success: true, message: 'Collection deleted' };
  }

  private mapCollection(c: Collection) {
    return {
      uuid: c.uuid,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageFileUuid: this.extractFileUuid(c.imageUrl),
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  // ── helpers ────────────────────────────────────────────
  private mapBrand(b: Brand) {
    return {
      uuid: b.uuid,
      name: b.name,
      slug: b.slug,
      description: b.description,
      logoFileUuid: this.extractFileUuid(b.logoUrl),
      isActive: b.isActive,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  private mapCategory(c: Category, productCount = 0) {
    return {
      uuid: c.uuid,
      publicId: c.publicId,
      title: c.title,
      slug: c.slug,
      description: c.description,
      parentUuid: c.parent?.uuid ?? null,
      parentTitle: c.parent?.title ?? null,
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      productCount,
      imageFileUuid: this.extractFileUuid(c.imageUrl),
      coverImageFileUuid: this.extractFileUuid(c.coverImageUrl),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private mapAttribute(a: Attribute) {
    return {
      uuid: a.uuid,
      name: a.name,
      slug: a.slug,
      type: a.type,
      displayOrder: a.displayOrder,
      isFilterable: a.isFilterable,
      isVisible: a.isVisible,
      isCustomerSelectable: a.isCustomerSelectable !== false,
      values: (a.values || [])
        .slice()
        .sort((x, y) => x.displayOrder - y.displayOrder)
        .map((v) => ({
          uuid: v.uuid,
          value: v.value,
          slug: v.slug,
          colorCode: v.colorCode,
          displayOrder: v.displayOrder,
        })),
      createdAt: a.createdAt,
    };
  }

  /** Category logos must be SVG files stored under product-categories */
  private async resolveCategoryLogoMarker(fileUuid?: string | null) {
    if (fileUuid === null || fileUuid === '') return null;
    if (!fileUuid) return null;
    const file = await this.fileRepo.findOne({ where: { uuid: fileUuid } });
    if (!file) throw new NotFoundException('Media file not found.');
    if (file.namespace !== StorageNamespace.PRODUCT_CATEGORIES) {
      throw new BadRequestException(
        'لوگوی دسته باید با namespace محصول-دسته (product-categories) آپلود شود.',
      );
    }
    if (!isSvgMime(file.mimeType, file.originalName)) {
      throw new BadRequestException('لوگوی دسته‌بندی فقط SVG مجاز است.');
    }
    return `file://${file.uuid}`;
  }

  /** Category cover photos must be raster images under product-categories */
  private async resolveCategoryCoverMarker(fileUuid?: string | null) {
    if (fileUuid === null || fileUuid === '') return null;
    if (!fileUuid) return null;
    const file = await this.fileRepo.findOne({ where: { uuid: fileUuid } });
    if (!file) throw new NotFoundException('Media file not found.');
    if (file.namespace !== StorageNamespace.PRODUCT_CATEGORIES) {
      throw new BadRequestException(
        'کاور دسته باید با namespace product-categories آپلود شود.',
      );
    }
    if (!isRasterImageMime(file.mimeType, file.originalName)) {
      throw new BadRequestException(
        'کاور دسته فقط تصویر JPEG/PNG/WebP مجاز است.',
      );
    }
    return `file://${file.uuid}`;
  }

  /** Store private file reference as file://{uuid} so we never expose MinIO URLs */
  private async resolveFileMarker(fileUuid?: string | null) {
    if (!fileUuid) return null;
    const file = await this.fileRepo.findOne({ where: { uuid: fileUuid } });
    if (!file) throw new NotFoundException('Media file not found.');
    return `file://${file.uuid}`;
  }

  private extractFileUuid(marker?: string | null) {
    if (!marker) return null;
    if (marker.startsWith('file://')) return marker.slice(7);
    return null;
  }

  private async uniqueBrandSlug(raw: string, excludeId?: number) {
    return this.uniqueSlug(this.brandRepo, 'slug', raw, excludeId);
  }
  private async uniqueCategorySlug(raw: string, excludeId?: number) {
    return this.uniqueSlug(this.categoryRepo, 'slug', raw, excludeId);
  }

  private async uniqueCategoryPublicId() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = generateCategoryPublicId();
      const existing = await this.categoryRepo.findOne({
        where: { publicId: candidate },
      });
      if (!existing) return candidate;
    }
    return generateCategoryPublicId(8);
  }

  private async uniqueAttributeSlug(raw: string, excludeId?: number) {
    return this.uniqueSlug(this.attributeRepo, 'slug', raw, excludeId);
  }

  private async uniqueSlug(
    repo: Repository<any>,
    field: string,
    raw: string,
    excludeId?: number,
  ) {
    let base = slugify(raw) || `item-${Date.now()}`;
    let candidate = base;
    let i = 2;
    while (true) {
      const existing = await repo.findOne({ where: { [field]: candidate } });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${i++}`;
    }
  }

  private async paginated(
    qb: any,
    query: CatalogListQueryDto,
    searchFields: string[],
    mapper: (rows: any[]) => any[],
  ) {
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((w: any) => {
          searchFields.forEach((f, idx) => {
            const key = `term${idx}`;
            if (idx === 0) w.where(`${f} ILIKE :${key}`, { [key]: term });
            else w.orWhere(`${f} ILIKE :${key}`, { [key]: term });
          });
        }),
      );
    }
    qb.orderBy('b.createdAt', 'DESC');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const total = await qb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();
    return {
      success: true,
      data: mapper(rows),
      meta: this.meta(safePage, limit, total, totalPages),
    };
  }

  private meta(page: number, limit: number, total: number, totalPages: number) {
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = total === 0 ? 0 : Math.min(page * limit, total);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      from,
      to,
    };
  }
}
