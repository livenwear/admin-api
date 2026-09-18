import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Inventory,
  ProductVariant,
  StockMovement,
  StockMovementType,
  User,
  Warehouse,
} from 'src/entities';
import { DataSource, Repository } from 'typeorm';
import {
  AdminInventoryAdjustDto,
  AdminInventoryOutOfStockDto,
  AdminInventorySetDto,
  AdminListInventoryQueryDto,
} from './dto/admin-inventory.dto';

@Injectable()
export class AdminInventoryService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    private readonly dataSource: DataSource,
  ) {}

  async ensureDefaultWarehouse() {
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

  private mapRow(
    variant: ProductVariant,
    inventory: Inventory | null,
    warehouse: Warehouse,
  ) {
    const quantity = inventory?.quantity ?? 0;
    const reservedQuantity = inventory?.reservedQuantity ?? 0;
    const available = Math.max(0, quantity - reservedQuantity);
    const product = variant.product as any;
    const price =
      (variant.prices || []).find((p: any) => p.isActive) ||
      variant.prices?.[0];
    const primaryImage =
      (product?.images || []).find((img: any) => img.isPrimary) ||
      product?.images?.[0];

    return {
      variantUuid: variant.uuid,
      sku: variant.sku,
      variantTitle: variant.title,
      isActive: variant.isActive,
      isDefault: variant.isDefault,
      quantity,
      reservedQuantity,
      available,
      stockStatus:
        available <= 0 ? 'out' : available <= 5 ? 'low' : ('in_stock' as const),
      price: price ? Number(price.amount) : null,
      warehouse: {
        uuid: warehouse.uuid,
        name: warehouse.name,
        code: warehouse.code,
      },
      product: product
        ? {
            uuid: product.uuid,
            publicId: product.publicId,
            name: product.name,
            slug: product.slug,
            status: product.status,
            fileUuid: primaryImage?.file?.uuid ?? null,
          }
        : null,
      updatedAt: inventory?.updatedAt || variant.updatedAt,
    };
  }

  async summary(lowThreshold = 5) {
    const warehouse = await this.ensureDefaultWarehouse();

    const raw = await this.variantRepo
      .createQueryBuilder('variant')
      .leftJoin(
        'variant.inventories',
        'inventory',
        'inventory.warehouseId = :wid',
        { wid: warehouse.id },
      )
      .innerJoin('variant.product', 'product')
      .select('COUNT(variant.id)', 'totalVariants')
      .addSelect(
        `SUM(CASE WHEN COALESCE(inventory.quantity, 0) - COALESCE(inventory.reservedQuantity, 0) <= 0 THEN 1 ELSE 0 END)`,
        'outOfStock',
      )
      .addSelect(
        `SUM(CASE WHEN COALESCE(inventory.quantity, 0) - COALESCE(inventory.reservedQuantity, 0) > 0 AND COALESCE(inventory.quantity, 0) - COALESCE(inventory.reservedQuantity, 0) <= :low THEN 1 ELSE 0 END)`,
        'lowStock',
      )
      .addSelect(
        `SUM(CASE WHEN COALESCE(inventory.quantity, 0) - COALESCE(inventory.reservedQuantity, 0) > :low THEN 1 ELSE 0 END)`,
        'inStock',
      )
      .addSelect('COALESCE(SUM(inventory.quantity), 0)', 'totalUnits')
      .setParameter('low', lowThreshold)
      .getRawOne<{
        totalVariants: string;
        outOfStock: string;
        lowStock: string;
        inStock: string;
        totalUnits: string;
      }>();

    return {
      success: true,
      data: {
        totalVariants: Number(raw?.totalVariants || 0),
        outOfStock: Number(raw?.outOfStock || 0),
        lowStock: Number(raw?.lowStock || 0),
        inStock: Number(raw?.inStock || 0),
        totalUnits: Number(raw?.totalUnits || 0),
        lowThreshold,
        warehouse: {
          uuid: warehouse.uuid,
          name: warehouse.name,
          code: warehouse.code,
        },
      },
    };
  }

  async list(query: AdminListInventoryQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const lowThreshold = Math.max(1, Number(query.lowThreshold) || 5);
    const stockStatus = query.stockStatus || 'all';
    const sortBy = query.sortBy || 'updatedAt';
    const sortOrder = query.sortOrder || 'DESC';
    const warehouse = await this.ensureDefaultWarehouse();

    const qb = this.variantRepo
      .createQueryBuilder('variant')
      .innerJoinAndSelect('variant.product', 'product')
      .leftJoinAndSelect(
        'variant.inventories',
        'inventory',
        'inventory.warehouseId = :wid',
        { wid: warehouse.id },
      )
      .leftJoinAndSelect('variant.prices', 'price')
      .leftJoinAndSelect('product.images', 'image')
      .leftJoinAndSelect('image.file', 'file');

    if (query.search?.trim()) {
      const q = `%${query.search.trim()}%`;
      qb.andWhere(
        `(product.name ILIKE :q OR variant.sku ILIKE :q OR variant.title ILIKE :q OR CAST(product.publicId AS text) ILIKE :q)`,
        { q },
      );
    }

    const availableExpr =
      'COALESCE(inventory.quantity, 0) - COALESCE(inventory.reservedQuantity, 0)';

    if (stockStatus === 'out') {
      qb.andWhere(`${availableExpr} <= 0`);
    } else if (stockStatus === 'low') {
      qb.andWhere(`${availableExpr} > 0 AND ${availableExpr} <= :low`, {
        low: lowThreshold,
      });
    } else if (stockStatus === 'in_stock') {
      qb.andWhere(`${availableExpr} > :low`, { low: lowThreshold });
    }

    if (sortBy === 'quantity') {
      // TypeORM orderBy cannot parse COALESCE(...) as an alias — use column only
      qb.orderBy('inventory.quantity', sortOrder);
    } else if (sortBy === 'name') {
      qb.orderBy('product.name', sortOrder);
    } else if (sortBy === 'sku') {
      qb.orderBy('variant.sku', sortOrder);
    } else {
      qb.orderBy('inventory.updatedAt', sortOrder);
      qb.addOrderBy('variant.updatedAt', sortOrder);
    }
    qb.addOrderBy('variant.id', 'DESC');

    const total = await qb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const rows = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    const from = total === 0 ? 0 : (safePage - 1) * limit + 1;
    const to = total === 0 ? 0 : Math.min(safePage * limit, total);

    return {
      success: true,
      data: rows.map((variant) => {
        const inv =
          (variant.inventories || []).find(
            (i: Inventory) => i.warehouseId === warehouse.id,
          ) ||
          variant.inventories?.[0] ||
          null;
        return this.mapRow(variant, inv || null, warehouse);
      }),
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

  private async getVariantOrFail(variantUuid: string) {
    const variant = await this.variantRepo.findOne({
      where: { uuid: variantUuid },
      relations: ['product', 'product.images', 'product.images.file', 'prices'],
    });
    if (!variant) throw new NotFoundException('واریانت یافت نشد.');
    return variant;
  }

  private async getOrCreateInventory(
    variantId: number,
    warehouse: Warehouse,
    manager?: DataSource['manager'],
  ) {
    const repo = manager
      ? manager.getRepository(Inventory)
      : this.inventoryRepo;
    let inventory = await repo.findOne({
      where: { variantId, warehouseId: warehouse.id },
    });
    if (!inventory) {
      inventory = await repo.save(
        repo.create({
          warehouseId: warehouse.id,
          variantId,
          quantity: 0,
          reservedQuantity: 0,
        }),
      );
    }
    return inventory;
  }

  private async recordMovement(
    manager: DataSource['manager'],
    payload: {
      warehouseId: number;
      variantId: number;
      type: StockMovementType;
      quantity: number;
      note?: string | null;
      createdById?: number | null;
    },
  ) {
    await manager.getRepository(StockMovement).save(
      manager.getRepository(StockMovement).create({
        warehouseId: payload.warehouseId,
        variantId: payload.variantId,
        type: payload.type,
        quantity: payload.quantity,
        referenceType: 'admin',
        referenceId: null,
        note: payload.note ?? null,
        createdById: payload.createdById ?? null,
      }),
    );
  }

  async adjust(variantUuid: string, dto: AdminInventoryAdjustDto, actor: User) {
    if (!dto.delta || dto.delta === 0) {
      throw new BadRequestException('مقدار تغییر نمی‌تواند صفر باشد.');
    }

    return this.dataSource.transaction(async (manager) => {
      const warehouse = await this.ensureDefaultWarehouse();
      const variant = await this.getVariantOrFail(variantUuid);
      const inventory = await this.getOrCreateInventory(
        variant.id,
        warehouse,
        manager,
      );

      const next = inventory.quantity + dto.delta;
      if (next < 0) {
        throw new BadRequestException(
          `موجودی کافی نیست. موجودی فعلی: ${inventory.quantity}`,
        );
      }
      if (next < inventory.reservedQuantity) {
        throw new BadRequestException(
          `موجودی نمی‌تواند از رزرو (${inventory.reservedQuantity}) کمتر شود.`,
        );
      }

      inventory.quantity = next;
      await manager.getRepository(Inventory).save(inventory);

      await this.recordMovement(manager, {
        warehouseId: warehouse.id,
        variantId: variant.id,
        type: dto.delta > 0 ? StockMovementType.IN : StockMovementType.OUT,
        quantity: Math.abs(dto.delta),
        note: dto.note.trim(),
        createdById: actor.id,
      });

      const fresh = await manager.getRepository(Inventory).findOne({
        where: { id: inventory.id },
      });
      return {
        success: true,
        message: 'موجودی به‌روزرسانی شد',
        data: this.mapRow(variant, fresh, warehouse),
      };
    });
  }

  async setQuantity(
    variantUuid: string,
    dto: AdminInventorySetDto,
    actor: User,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const warehouse = await this.ensureDefaultWarehouse();
      const variant = await this.getVariantOrFail(variantUuid);
      const inventory = await this.getOrCreateInventory(
        variant.id,
        warehouse,
        manager,
      );

      if (dto.quantity < inventory.reservedQuantity) {
        throw new BadRequestException(
          `مقدار نمی‌تواند از رزرو (${inventory.reservedQuantity}) کمتر باشد.`,
        );
      }

      inventory.quantity = dto.quantity;
      await manager.getRepository(Inventory).save(inventory);

      await this.recordMovement(manager, {
        warehouseId: warehouse.id,
        variantId: variant.id,
        type: StockMovementType.ADJUSTMENT,
        quantity: dto.quantity,
        note: dto.note.trim(),
        createdById: actor.id,
      });

      const fresh = await manager.getRepository(Inventory).findOne({
        where: { id: inventory.id },
      });
      return {
        success: true,
        message: 'موجودی تنظیم شد',
        data: this.mapRow(variant, fresh, warehouse),
      };
    });
  }

  async markOutOfStock(
    variantUuid: string,
    dto: AdminInventoryOutOfStockDto,
    actor: User,
  ) {
    return this.setQuantity(
      variantUuid,
      {
        quantity: 0,
        note: dto.note.trim(),
      },
      actor,
    );
  }

  async recentMovements(variantUuid: string, limit = 20) {
    const variant = await this.getVariantOrFail(variantUuid);
    const rows = await this.movementRepo.find({
      where: { variantId: variant.id },
      order: { createdAt: 'DESC' },
      take: Math.min(50, Math.max(1, limit)),
      relations: ['createdBy'],
    });

    return {
      success: true,
      data: {
        items: rows.map((m) => ({
          uuid: m.uuid,
          type: m.type,
          quantity: m.quantity,
          note: m.note,
          createdAt: m.createdAt,
          createdBy: m.createdBy
            ? {
                firstName: (m.createdBy as User).firstName,
                lastName: (m.createdBy as User).lastName,
              }
            : null,
        })),
      },
    };
  }
}
