import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { slugify } from 'src/common/utils/slugify';
import { generateProductPublicId } from 'src/common/utils/product-public-id';
import {
  AttributeValue,
  Brand,
  Category,
  Collection,
  FileEntity,
  Inventory,
  Price,
  Product,
  ProductCategory,
  ProductCollection,
  ProductFile,
  ProductImage,
  ProductLabel,
  ProductRelated,
  ProductSpecification,
  ProductStatus,
  ProductTag,
  ProductType,
  ProductVariant,
  Tag,
  VariantAttributeValue,
  Warehouse,
} from 'src/entities';
import { StorageService } from 'src/storage/storage.service';
import { MediaFilesService } from 'src/storage/media-files.service';
import {
  pickEffectivePrice,
  priceAmounts,
  sameMoney,
} from 'src/common/pricing/effective-price';
import { Brackets, In, Repository } from 'typeorm';
import {
  AdminCreateProductDto,
  AdminCreateVariantPriceDto,
  AdminListProductsQueryDto,
  AdminUpdateProductDto,
  ProductFileAttachDto,
  ProductImageDto,
  ProductLabelDto,
  ProductRelatedDto,
  ProductVariantDto,
} from './dto/admin-products.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Price) private readonly priceRepo: Repository<Price>,
    @InjectRepository(ProductImage)
    private readonly imageRepo: Repository<ProductImage>,
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepo: Repository<ProductCategory>,
    @InjectRepository(ProductSpecification)
    private readonly specRepo: Repository<ProductSpecification>,
    @InjectRepository(VariantAttributeValue)
    private readonly vavRepo: Repository<VariantAttributeValue>,
    @InjectRepository(Brand) private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(AttributeValue)
    private readonly attrValueRepo: Repository<AttributeValue>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(Tag) private readonly tagRepo: Repository<Tag>,
    @InjectRepository(ProductTag)
    private readonly productTagRepo: Repository<ProductTag>,
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,
    @InjectRepository(ProductCollection)
    private readonly productCollectionRepo: Repository<ProductCollection>,
    @InjectRepository(ProductLabel)
    private readonly labelRepo: Repository<ProductLabel>,
    @InjectRepository(ProductRelated)
    private readonly relatedRepo: Repository<ProductRelated>,
    @InjectRepository(ProductFile)
    private readonly productFileRepo: Repository<ProductFile>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    private readonly storageService: StorageService,
    private readonly mediaFiles: MediaFilesService,
  ) {}

  async list(query: AdminListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = ['createdAt', 'updatedAt', 'name', 'status'].includes(
      query.sortBy || '',
    )
      ? query.sortBy!
      : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.productCategories', 'pc')
      .leftJoinAndSelect('pc.category', 'category')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('images.file', 'file')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('variants.prices', 'prices')
      .leftJoinAndSelect('variants.inventories', 'inventories');

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('product.name ILIKE :term', { term })
            .orWhere('product.slug ILIKE :term', { term })
            .orWhere('product.metaTitle ILIKE :term', { term })
            .orWhere('variants.sku ILIKE :term', { term });
        }),
      );
    }

    if (query.status) qb.andWhere('product.status = :status', { status: query.status });
    if (query.isFeatured === 'true' || query.isFeatured === 'false') {
      qb.andWhere('product.isFeatured = :feat', {
        feat: query.isFeatured === 'true',
      });
    }
    if (query.isAmazing === 'true' || query.isAmazing === 'false') {
      qb.andWhere('product.isAmazing = :amazing', {
        amazing: query.isAmazing === 'true',
      });
    }
    if (query.isListedOnTorob === 'true' || query.isListedOnTorob === 'false') {
      qb.andWhere('product.isListedOnTorob = :torob', {
        torob: query.isListedOnTorob === 'true',
      });
    }
    if (query.isListedOnEmalls === 'true' || query.isListedOnEmalls === 'false') {
      qb.andWhere('product.isListedOnEmalls = :emalls', {
        emalls: query.isListedOnEmalls === 'true',
      });
    }
    if (query.brandUuid) {
      qb.andWhere('brand.uuid = :brandUuid', { brandUuid: query.brandUuid });
    }
    if (query.categoryUuid) {
      qb.andWhere('category.uuid = :categoryUuid', {
        categoryUuid: query.categoryUuid,
      });
    }

    const attrUuids = (query.attributeValueUuids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (attrUuids.length) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM product_variants pv
          INNER JOIN variant_attribute_values vav ON vav.variant_id = pv.id
          INNER JOIN attribute_values av ON av.id = vav.attribute_value_id
          WHERE pv.product_id = product.id
            AND av.uuid IN (:...attrUuids)
        )`,
        { attrUuids },
      );
    }

    qb.orderBy(`product.${sortBy}`, sortOrder);

    const total = await qb.clone().getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    const data = await Promise.all(rows.map((p) => this.mapProduct(p, false)));
    const from = total === 0 ? 0 : (safePage - 1) * limit + 1;
    const to = total === 0 ? 0 : Math.min(safePage * limit, total);

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
        from,
        to,
        sortBy,
        sortOrder,
      },
    };
  }

  async getOne(uuid: string) {
    const product = await this.loadProduct(uuid);
    return { success: true, data: await this.mapProduct(product, true) };
  }

  async create(dto: AdminCreateProductDto) {
    this.assertTypeVariants(dto.type ?? ProductType.VARIABLE, dto.variants);

    const slug = await this.uniqueProductSlug(dto.slug || dto.name);
    const brand = dto.brandUuid
      ? await this.brandRepo.findOne({ where: { uuid: dto.brandUuid } })
      : null;
    if (dto.brandUuid && !brand) throw new NotFoundException('Brand not found.');

    const product = await this.productRepo.save(
      this.productRepo.create({
        name: dto.name,
        slug,
        publicId: await this.uniquePublicId(),
        description: dto.description ?? null,
        expertReview: dto.expertReview ?? null,
        shortDescription: dto.shortDescription ?? null,
        brand: brand || null,
        type: dto.type ?? ProductType.VARIABLE,
        status: dto.status ?? ProductStatus.DRAFT,
        metaTitle: dto.metaTitle ?? dto.name,
        metaDescription: dto.metaDescription ?? dto.shortDescription ?? null,
        metaKeywords: dto.metaKeywords ?? null,
        isFeatured: dto.isFeatured ?? false,
        isAmazing: dto.isAmazing ?? false,
        isListedOnTorob: dto.isListedOnTorob ?? false,
        isListedOnEmalls: dto.isListedOnEmalls ?? false,
        isUnavailable: dto.isUnavailable ?? false,
        ratingAvg: String(dto.ratingAvg ?? 0),
        ratingCount: dto.ratingCount ?? 0,
      }),
    );

    await this.syncCategories(product, dto.categoryUuids || []);
    await this.syncSpecifications(product, dto.specifications || []);
    await this.syncTags(product, dto.tagUuids || []);
    await this.syncCollections(product, dto.collectionUuids || []);
    await this.syncLabels(product, dto.labels || []);
    await this.syncRelated(product, dto.relatedProducts || []);
    await this.syncFiles(product, dto.files || []);
    await this.syncVariants(product, dto.variants);
    if (dto.images?.length) await this.syncImages(product, dto.images);

    const full = await this.loadProduct(product.uuid);
    return {
      success: true,
      message: 'Product created',
      data: await this.mapProduct(full, true),
    };
  }

  async update(uuid: string, dto: AdminUpdateProductDto) {
    const product = await this.loadProduct(uuid);

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.slug !== undefined)
      product.slug = await this.uniqueProductSlug(dto.slug, product.id);
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.expertReview !== undefined) product.expertReview = dto.expertReview;
    if (dto.shortDescription !== undefined)
      product.shortDescription = dto.shortDescription;
    if (dto.type !== undefined) product.type = dto.type;
    if (dto.status !== undefined) product.status = dto.status;
    if (dto.metaTitle !== undefined) product.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined)
      product.metaDescription = dto.metaDescription;
    if (dto.metaKeywords !== undefined) product.metaKeywords = dto.metaKeywords;
    if (dto.isFeatured !== undefined) product.isFeatured = dto.isFeatured;
    if (dto.isAmazing !== undefined) product.isAmazing = dto.isAmazing;
    if (dto.isListedOnTorob !== undefined)
      product.isListedOnTorob = dto.isListedOnTorob;
    if (dto.isListedOnEmalls !== undefined)
      product.isListedOnEmalls = dto.isListedOnEmalls;
    if (dto.isUnavailable !== undefined)
      product.isUnavailable = dto.isUnavailable;
    if (dto.ratingAvg !== undefined) product.ratingAvg = String(dto.ratingAvg);
    if (dto.ratingCount !== undefined) product.ratingCount = dto.ratingCount;

    if (dto.brandUuid !== undefined) {
      if (!dto.brandUuid) product.brand = null;
      else {
        const brand = await this.brandRepo.findOne({
          where: { uuid: dto.brandUuid },
        });
        if (!brand) throw new NotFoundException('Brand not found.');
        product.brand = brand;
      }
    }

    await this.productRepo.save(product);

    if (dto.categoryUuids) await this.syncCategories(product, dto.categoryUuids);
    if (dto.specifications) await this.syncSpecifications(product, dto.specifications);
    if (dto.tagUuids) await this.syncTags(product, dto.tagUuids);
    if (dto.collectionUuids) await this.syncCollections(product, dto.collectionUuids);
    if (dto.labels) await this.syncLabels(product, dto.labels);
    if (dto.relatedProducts) await this.syncRelated(product, dto.relatedProducts);
    if (dto.files) await this.syncFiles(product, dto.files);
    if (dto.variants) {
      this.assertTypeVariants(product.type, dto.variants);
      await this.syncVariants(product, dto.variants, true);
    }
    if (dto.images) await this.syncImages(product, dto.images, true);

    const full = await this.loadProduct(uuid);
    return {
      success: true,
      message: 'Product updated',
      data: await this.mapProduct(full, true),
    };
  }

  async remove(uuid: string) {
    const product = await this.loadProduct(uuid);
    await this.productRepo.softRemove(product);
    return { success: true, message: 'Product deleted' };
  }

  async addImage(productUuid: string, dto: ProductImageDto) {
    const product = await this.loadProduct(productUuid);
    const nextOrder =
      dto.displayOrder ??
      Math.max(
        -1,
        ...((product.images || []).map((i) => i.displayOrder || 0) as number[]),
      ) + 1;
    await this.attachImage(product, { ...dto, displayOrder: nextOrder });
    const full = await this.loadProduct(productUuid);
    return { success: true, data: await this.mapProduct(full, true) };
  }

  async reorderImages(
    productUuid: string,
    items: Array<{ uuid: string; displayOrder: number; isPrimary?: boolean }>,
  ) {
    const product = await this.loadProduct(productUuid);
    const existing = await this.imageRepo.find({
      where: { productId: product.id },
    });
    if (!existing.length) {
      throw new BadRequestException('این محصول تصویری ندارد.');
    }
    const byUuid = new Map(existing.map((img) => [img.uuid, img]));
    for (const item of items) {
      if (!byUuid.has(item.uuid)) {
        throw new BadRequestException(`تصویر نامعتبر: ${item.uuid}`);
      }
    }

    const wantsPrimary = items.some((i) => i.isPrimary === true);
    if (wantsPrimary) {
      for (const img of existing) {
        img.isPrimary = false;
      }
    }

    for (const item of items) {
      const img = byUuid.get(item.uuid)!;
      img.displayOrder = item.displayOrder;
      if (item.isPrimary === true) img.isPrimary = true;
    }

    if (!existing.some((img) => img.isPrimary) && existing.length) {
      const firstUuid = [...items].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      )[0]?.uuid;
      const first = (firstUuid && byUuid.get(firstUuid)) || existing[0];
      first.isPrimary = true;
    }

    await this.imageRepo.save(existing);
    const full = await this.loadProduct(productUuid);
    return { success: true, data: await this.mapProduct(full, true) };
  }

  async removeImage(productUuid: string, imageUuid: string) {
    const product = await this.loadProduct(productUuid);
    const image = await this.imageRepo.findOne({
      where: { uuid: imageUuid, productId: product.id },
      relations: ['file'],
    });
    if (!image) throw new NotFoundException('Image not found.');

    const wasPrimary = image.isPrimary;
    const file = image.file as FileEntity | undefined;
    if (file) {
      await this.mediaFiles.removeSynced(file);
    }
    await this.imageRepo.remove(image);

    if (wasPrimary) {
      const next = await this.imageRepo.find({
        where: { productId: product.id },
        order: { displayOrder: 'ASC' },
      });
      if (next[0]) {
        next[0].isPrimary = true;
        await this.imageRepo.save(next[0]);
      }
    }

    const full = await this.loadProduct(productUuid);
    return { success: true, data: await this.mapProduct(full, true) };
  }

  // ── internals ──────────────────────────────────────────
  private async loadProduct(uuid: string) {
    const product = await this.productRepo.findOne({
      where: { uuid },
      relations: [
        'brand',
        'productCategories',
        'productCategories.category',
        'images',
        'images.file',
        'images.variant',
        'variants',
        'variants.prices',
        'variants.inventories',
        'variants.variantAttributeValues',
        'variants.variantAttributeValues.attributeValue',
        'variants.variantAttributeValues.attributeValue.attribute',
        'specifications',
        'productTags',
        'productTags.tag',
        'productCollections',
        'productCollections.collection',
        'labels',
        'relatedFrom',
        'relatedFrom.relatedProduct',
        'productFiles',
        'productFiles.file',
      ],
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  private assertTypeVariants(
    type: ProductType,
    variants: ProductVariantDto[] | undefined,
  ) {
    if (!variants?.length) {
      throw new BadRequestException('At least one variant is required.');
    }
    if (type === ProductType.SIMPLE && variants.length > 1) {
      throw new BadRequestException(
        'Simple products must have exactly one variant.',
      );
    }
  }

  private async syncTags(product: Product, tagUuids: string[]) {
    await this.productTagRepo.delete({ productId: product.id });
    if (!tagUuids.length) return;
    const tags = await this.tagRepo.find({ where: { uuid: In(tagUuids) } });
    if (tags.length !== tagUuids.length) {
      throw new BadRequestException('One or more tags not found.');
    }
    for (const tag of tags) {
      await this.productTagRepo.save(
        this.productTagRepo.create({ product, tag }),
      );
    }
  }

  private async syncCollections(product: Product, collectionUuids: string[]) {
    await this.productCollectionRepo.delete({ productId: product.id });
    if (!collectionUuids.length) return;
    const collections = await this.collectionRepo.find({
      where: { uuid: In(collectionUuids) },
    });
    if (collections.length !== collectionUuids.length) {
      throw new BadRequestException('One or more collections not found.');
    }
    for (let i = 0; i < collections.length; i++) {
      await this.productCollectionRepo.save(
        this.productCollectionRepo.create({
          product,
          collection: collections[i],
          displayOrder: i,
        }),
      );
    }
  }

  private async syncLabels(product: Product, labels: ProductLabelDto[]) {
    await this.labelRepo.delete({ productId: product.id });
    for (const item of labels) {
      await this.labelRepo.save(
        this.labelRepo.create({
          product,
          label: item.label,
          colorCode: item.colorCode ?? null,
          startsAt: item.startsAt ? new Date(item.startsAt) : null,
          endsAt: item.endsAt ? new Date(item.endsAt) : null,
          isActive: item.isActive ?? true,
        }),
      );
    }
  }

  private async syncRelated(product: Product, related: ProductRelatedDto[]) {
    await this.relatedRepo.delete({ productId: product.id });
    for (const item of related) {
      if (item.productUuid === product.uuid) {
        throw new BadRequestException('Product cannot relate to itself.');
      }
      const target = await this.productRepo.findOne({
        where: { uuid: item.productUuid },
      });
      if (!target) throw new NotFoundException('Related product not found.');
      await this.relatedRepo.save(
        this.relatedRepo.create({
          product,
          relatedProduct: target,
          relationType: item.relationType || 'related',
        }),
      );
    }
  }

  private async syncFiles(product: Product, files: ProductFileAttachDto[]) {
    await this.productFileRepo.delete({ productId: product.id });
    for (let i = 0; i < files.length; i++) {
      const file = await this.fileRepo.findOne({
        where: { uuid: files[i].fileUuid },
      });
      if (!file) throw new NotFoundException('Product file media not found.');
      await this.productFileRepo.save(
        this.productFileRepo.create({
          product,
          file,
          label: files[i].label ?? null,
          displayOrder: files[i].displayOrder ?? i,
        }),
      );
    }
  }

  private async ensureDefaultWarehouse() {
    let warehouse = await this.warehouseRepo.findOne({
      where: { isDefault: true },
    });
    if (!warehouse) {
      warehouse = await this.warehouseRepo.save(
        this.warehouseRepo.create({
          name: 'انبار اصلی',
          code: 'MAIN',
          address: null,
          isActive: true,
          isDefault: true,
        }),
      );
    }
    return warehouse;
  }

  private async syncCategories(product: Product, categoryUuids: string[]) {
    await this.productCategoryRepo.delete({ productId: product.id });
    if (!categoryUuids.length) return;
    const categories = await this.categoryRepo.find({
      where: { uuid: In(categoryUuids) },
    });
    if (categories.length !== categoryUuids.length) {
      throw new BadRequestException('One or more categories not found.');
    }
    for (let i = 0; i < categories.length; i++) {
      await this.productCategoryRepo.save(
        this.productCategoryRepo.create({
          product,
          category: categories[i],
          displayOrder: i,
        }),
      );
    }
  }

  private async syncSpecifications(
    product: Product,
    specs: Array<{ label: string; value: string; displayOrder?: number }>,
  ) {
    await this.specRepo.delete({ productId: product.id });
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      await this.specRepo.save(
        this.specRepo.create({
          product,
          label: s.label,
          value: s.value,
          displayOrder: s.displayOrder ?? i,
        }),
      );
    }
  }

  private async syncVariants(
    product: Product,
    variants: ProductVariantDto[],
    replace = false,
  ) {
    const warehouse = await this.ensureDefaultWarehouse();

    const existing = await this.variantRepo.find({
      where: { productId: product.id },
      relations: ['inventories', 'prices', 'variantAttributeValues'],
    });
    const bySku = new Map(existing.map((v) => [v.sku, v]));
    const byUuid = new Map(existing.map((v) => [v.uuid, v]));
    const seenIds = new Set<number>();

    let defaultSet = false;
    for (const dto of variants) {
      const isDefault = dto.isDefault ?? (!defaultSet && true);
      if (isDefault) defaultSet = true;

      let variant =
        (dto.uuid ? byUuid.get(dto.uuid) : undefined) || bySku.get(dto.sku);

      if (variant) {
        variant.sku = dto.sku;
        variant.title = dto.title ?? null;
        variant.barcode = dto.barcode ?? null;
        variant.isDefault = isDefault;
        variant.isActive = dto.isActive ?? true;
        variant.weight = dto.weight != null ? String(dto.weight) : null;
        variant.length = dto.length != null ? String(dto.length) : null;
        variant.width = dto.width != null ? String(dto.width) : null;
        variant.height = dto.height != null ? String(dto.height) : null;
        variant = await this.variantRepo.save(variant);
      } else {
        variant = await this.variantRepo.save(
          this.variantRepo.create({
            product,
            sku: dto.sku,
            title: dto.title ?? null,
            barcode: dto.barcode ?? null,
            isDefault,
            isActive: dto.isActive ?? true,
            weight: dto.weight != null ? String(dto.weight) : null,
            length: dto.length != null ? String(dto.length) : null,
            width: dto.width != null ? String(dto.width) : null,
            height: dto.height != null ? String(dto.height) : null,
          }),
        );
      }
      seenIds.add(variant.id);

      const prices = await this.priceRepo.find({
        where: { variantId: variant.id },
        order: { createdAt: 'ASC' },
      });
      const current = pickEffectivePrice(prices);
      const amounts = priceAmounts(current);
      const priceChanged =
        !current ||
        !sameMoney(amounts.amount, dto.price) ||
        !sameMoney(amounts.compareAtAmount, dto.compareAtPrice ?? null);

      if (priceChanged) {
        const effectiveFrom = dto.priceEffectiveFrom
          ? new Date(dto.priceEffectiveFrom)
          : new Date();
        if (Number.isNaN(effectiveFrom.getTime())) {
          throw new BadRequestException('Invalid priceEffectiveFrom.');
        }
        await this.priceRepo.save(
          this.priceRepo.create({
            variant,
            amount: String(dto.price),
            compareAtAmount:
              dto.compareAtPrice != null ? String(dto.compareAtPrice) : null,
            currency: 'IRR',
            isActive: true,
            effectiveFrom,
            note: null,
          }),
        );
      }

      const inv =
        (variant.inventories || []).find((i) => i.warehouseId === warehouse.id) ||
        (variant.inventories || [])[0];

      if (dto.stockQuantity != null) {
        if (inv) {
          inv.quantity = dto.stockQuantity;
          inv.reservedQuantity = 0;
          await this.inventoryRepo.save(inv);
        } else {
          await this.inventoryRepo.save(
            this.inventoryRepo.create({
              warehouse,
              variant,
              quantity: dto.stockQuantity,
              reservedQuantity: 0,
            }),
          );
        }
      } else if (!inv) {
        await this.inventoryRepo.save(
          this.inventoryRepo.create({
            warehouse,
            variant,
            quantity: 0,
            reservedQuantity: 0,
          }),
        );
      }

      if (dto.attributeValueUuids) {
        await this.vavRepo.delete({ variantId: variant.id });
        if (dto.attributeValueUuids.length) {
          const values = await this.attrValueRepo.find({
            where: { uuid: In(dto.attributeValueUuids) },
            relations: ['attribute'],
          });
          if (values.length !== dto.attributeValueUuids.length) {
            throw new BadRequestException('Invalid attribute value uuid.');
          }
          for (const value of values) {
            await this.vavRepo.save(
              this.vavRepo.create({ variant, attributeValue: value }),
            );
          }
        }
      }
    }

    if (replace) {
      for (const v of existing) {
        if (seenIds.has(v.id)) continue;
        v.isActive = false;
        await this.variantRepo.save(v);
      }
    }
  }

  async listVariantPrices(productUuid: string, variantUuid: string) {
    const product = await this.productRepo.findOne({
      where: { uuid: productUuid },
    });
    if (!product) throw new NotFoundException('Product not found.');

    const variant = await this.variantRepo.findOne({
      where: { uuid: variantUuid, productId: product.id },
    });
    if (!variant) throw new NotFoundException('Variant not found.');

    const prices = await this.priceRepo
      .createQueryBuilder('p')
      .where('p.variantId = :vid', { vid: variant.id })
      .andWhere('p.deletedAt IS NULL')
      .orderBy('COALESCE(p.effectiveFrom, p.createdAt)', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .getMany();

    const now = new Date();
    const effective = pickEffectivePrice(prices, now);
    const mapped = prices.map((p) => this.mapPriceRow(p, effective?.uuid === p.uuid, now));

    return {
      success: true,
      data: {
        variant: {
          uuid: variant.uuid,
          sku: variant.sku,
          title: variant.title,
        },
        current: effective
          ? this.mapPriceRow(effective, true, now)
          : null,
        prices: mapped,
      },
    };
  }

  async addVariantPrice(
    productUuid: string,
    variantUuid: string,
    dto: AdminCreateVariantPriceDto,
  ) {
    const product = await this.productRepo.findOne({
      where: { uuid: productUuid },
    });
    if (!product) throw new NotFoundException('Product not found.');

    const variant = await this.variantRepo.findOne({
      where: { uuid: variantUuid, productId: product.id },
    });
    if (!variant) throw new NotFoundException('Variant not found.');

    if (dto.compareAtAmount != null && dto.compareAtAmount < dto.amount) {
      throw new BadRequestException(
        'compareAtAmount must be greater than or equal to amount.',
      );
    }

    const effectiveFrom = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : new Date();
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('Invalid effectiveFrom.');
    }

    const saved = await this.priceRepo.save(
      this.priceRepo.create({
        variant,
        amount: String(dto.amount),
        compareAtAmount:
          dto.compareAtAmount != null ? String(dto.compareAtAmount) : null,
        currency: 'IRR',
        isActive: true,
        effectiveFrom,
        note: dto.note?.trim() || null,
      }),
    );

    const list = await this.listVariantPrices(productUuid, variantUuid);
    return {
      success: true,
      message: 'Price entry created',
      data: {
        ...list.data,
        createdUuid: saved.uuid,
      },
    };
  }

  async voidVariantPrice(
    productUuid: string,
    variantUuid: string,
    priceUuid: string,
  ) {
    const product = await this.productRepo.findOne({
      where: { uuid: productUuid },
    });
    if (!product) throw new NotFoundException('Product not found.');

    const variant = await this.variantRepo.findOne({
      where: { uuid: variantUuid, productId: product.id },
    });
    if (!variant) throw new NotFoundException('Variant not found.');

    const price = await this.priceRepo.findOne({
      where: { uuid: priceUuid, variantId: variant.id },
    });
    if (!price) throw new NotFoundException('Price entry not found.');

    price.isActive = false;
    await this.priceRepo.save(price);

    return this.listVariantPrices(productUuid, variantUuid).then((list) => ({
      success: true,
      message: 'Price entry voided',
      data: list.data,
    }));
  }

  private mapPriceRow(p: Price, isCurrent: boolean, now: Date) {
    const from = p.effectiveFrom ? new Date(p.effectiveFrom) : null;
    const status: 'current' | 'scheduled' | 'historical' | 'voided' =
      !p.isActive
        ? 'voided'
        : isCurrent
          ? 'current'
          : from && from.getTime() > now.getTime()
            ? 'scheduled'
            : 'historical';

    return {
      uuid: p.uuid,
      amount: Number(p.amount),
      compareAtAmount: p.compareAtAmount != null ? Number(p.compareAtAmount) : null,
      currency: p.currency,
      effectiveFrom: p.effectiveFrom
        ? new Date(p.effectiveFrom).toISOString()
        : null,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      note: p.note,
      isActive: p.isActive,
      status,
      isCurrent,
    };
  }

  private async syncImages(
    product: Product,
    images: ProductImageDto[],
    replace = false,
  ) {
    if (replace) {
      const existing = await this.imageRepo.find({
        where: { productId: product.id },
        relations: ['file'],
      });
      for (const img of existing) {
        await this.imageRepo.remove(img);
      }
    }
    for (const dto of images) {
      await this.attachImage(product, dto);
    }
  }

  private async attachImage(product: Product, dto: ProductImageDto) {
    const file = await this.fileRepo.findOne({ where: { uuid: dto.fileUuid } });
    if (!file) throw new NotFoundException('Media file not found.');

    let variant: ProductVariant | null = null;
    if (dto.variantUuid) {
      variant = await this.variantRepo.findOne({
        where: { uuid: dto.variantUuid, productId: product.id },
      });
      if (!variant) throw new NotFoundException('Variant not found.');
    }

    if (dto.isPrimary) {
      await this.imageRepo.update(
        { productId: product.id },
        { isPrimary: false },
      );
    }

    await this.imageRepo.save(
      this.imageRepo.create({
        product,
        variant,
        file,
        altText: dto.altText ?? product.name,
        displayOrder: dto.displayOrder ?? 0,
        isPrimary: dto.isPrimary ?? false,
      }),
    );
  }

  private async mapProduct(product: Product, detailed: boolean) {
    const images = await Promise.all(
      (product.images || [])
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(async (img) => {
          const file = img.file as FileEntity | undefined;
          let accessUrl: string | null = null;
          if (file) {
            try {
              accessUrl = await this.storageService.getPresignedUrl(
                file.bucket,
                file.objectKey,
                3600,
              );
            } catch {
              accessUrl = null;
            }
          }
          return {
            uuid: img.uuid,
            altText: img.altText,
            displayOrder: img.displayOrder,
            isPrimary: img.isPrimary,
            variantUuid: img.variant?.uuid ?? null,
            fileUuid: file?.uuid ?? null,
            accessUrl,
          };
        }),
    );

    const variants = (product.variants || []).map((v) => {
      const price = pickEffectivePrice(v.prices || []);
      const amounts = priceAmounts(price);
      const inv = (v.inventories || [])[0];
      return {
        uuid: v.uuid,
        sku: v.sku,
        title: v.title,
        barcode: v.barcode,
        isDefault: v.isDefault,
        isActive: v.isActive,
        weight: v.weight,
        length: v.length,
        width: v.width,
        height: v.height,
        stockQuantity: inv?.quantity ?? 0,
        reservedQuantity: inv?.reservedQuantity ?? 0,
        price: amounts.amount,
        compareAtPrice: amounts.compareAtAmount,
        currency: amounts.currency,
        attributes: (v.variantAttributeValues || []).map((vav: any) => ({
          attributeUuid: vav.attributeValue?.attribute?.uuid,
          attributeName: vav.attributeValue?.attribute?.name,
          attributeSlug: vav.attributeValue?.attribute?.slug,
          valueUuid: vav.attributeValue?.uuid,
          value: vav.attributeValue?.value,
          valueSlug: vav.attributeValue?.slug,
          colorCode: vav.attributeValue?.colorCode,
        })),
      };
    });

    const base = {
      uuid: product.uuid,
      publicId: product.publicId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      expertReview: product.expertReview,
      shortDescription: product.shortDescription,
      type: product.type,
      status: product.status,
      isFeatured: product.isFeatured,
      isAmazing: product.isAmazing,
      isListedOnTorob: Boolean(product.isListedOnTorob),
      isListedOnEmalls: Boolean(product.isListedOnEmalls),
      isUnavailable: Boolean(product.isUnavailable),
      ratingAvg: Number(product.ratingAvg || 0),
      ratingCount: product.ratingCount || 0,
      viewCount: product.viewCount,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      metaKeywords: product.metaKeywords,
      brand: product.brand
        ? {
            uuid: product.brand.uuid,
            name: product.brand.name,
            slug: product.brand.slug,
          }
        : null,
      categories: (product.productCategories || [])
        .map((pc: any) => ({
          uuid: pc.category?.uuid,
          title: pc.category?.title,
          slug: pc.category?.slug,
        }))
        .filter((c: { uuid?: string }) => Boolean(c.uuid)),
      tags: (product.productTags || []).map((pt: any) => ({
        uuid: pt.tag?.uuid,
        name: pt.tag?.name,
        slug: pt.tag?.slug,
      })),
      collections: (product.productCollections || []).map((pc: any) => ({
        uuid: pc.collection?.uuid,
        name: pc.collection?.name,
        slug: pc.collection?.slug,
      })),
      labels: (product.labels || []).map((l: any) => ({
        uuid: l.uuid,
        label: l.label,
        colorCode: l.colorCode,
        startsAt: l.startsAt,
        endsAt: l.endsAt,
        isActive: l.isActive,
      })),
      primaryImage: images.find((i) => i.isPrimary) || images[0] || null,
      images,
      variants,
      minPrice: variants.reduce<number | null>((min, v) => {
        if (v.price == null) return min;
        if (min == null) return v.price;
        return Math.min(min, v.price);
      }, null),
      totalStock: variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    if (!detailed) return base;

    const files = await Promise.all(
      (product.productFiles || []).map(async (pf: any) => {
        const file = pf.file as FileEntity | undefined;
        let accessUrl: string | null = null;
        if (file) {
          try {
            accessUrl = await this.storageService.getPresignedUrl(
              file.bucket,
              file.objectKey,
              3600,
            );
          } catch {
            accessUrl = null;
          }
        }
        return {
          uuid: pf.uuid,
          label: pf.label,
          displayOrder: pf.displayOrder,
          fileUuid: file?.uuid ?? null,
          originalName: file?.originalName ?? null,
          accessUrl,
        };
      }),
    );

    return {
      ...base,
      specifications: (product.specifications || [])
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => ({
          uuid: s.uuid,
          label: s.label,
          value: s.value,
          displayOrder: s.displayOrder,
        })),
      relatedProducts: (product.relatedFrom || []).map((r: any) => ({
        uuid: r.uuid,
        relationType: r.relationType,
        product: r.relatedProduct
          ? {
              uuid: r.relatedProduct.uuid,
              name: r.relatedProduct.name,
              slug: r.relatedProduct.slug,
            }
          : null,
      })),
      files,
    };
  }

  private async uniqueProductSlug(raw: string, excludeId?: number) {
    let base = slugify(raw) || `product-${Date.now()}`;
    let candidate = base;
    let i = 2;
    while (true) {
      const existing = await this.productRepo.findOne({
        where: { slug: candidate },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${i++}`;
    }
  }

  private async uniquePublicId() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = generateProductPublicId();
      const existing = await this.productRepo.findOne({
        where: { publicId: candidate },
      });
      if (!existing) return candidate;
    }
    throw new BadRequestException('Could not allocate product public id.');
  }
}
