import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Inventory,
  StockMovement,
  StockMovementType,
  Warehouse,
} from 'src/entities';
import { EntityManager, Repository } from 'typeorm';

type LineNeed = { variantId: number; quantity: number };

@Injectable()
export class OrderInventoryService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
  ) {}

  async ensureDefaultWarehouse(manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Warehouse) : this.warehouseRepo;
    let warehouse = await repo.findOne({ where: { isDefault: true } });
    if (!warehouse) {
      warehouse = await repo.save(
        repo.create({
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

  private async lockInventory(
    manager: EntityManager,
    warehouseId: number,
    variantId: number,
  ) {
    let inv = await manager
      .getRepository(Inventory)
      .createQueryBuilder('inv')
      .setLock('pessimistic_write')
      .where('inv.warehouse_id = :warehouseId', { warehouseId })
      .andWhere('inv.variant_id = :variantId', { variantId })
      .getOne();

    if (!inv) {
      inv = await manager.getRepository(Inventory).save(
        manager.getRepository(Inventory).create({
          warehouseId,
          variantId,
          quantity: 0,
          reservedQuantity: 0,
        }),
      );
      inv = await manager
        .getRepository(Inventory)
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.id = :id', { id: inv.id })
        .getOne();
    }

    if (!inv) throw new NotFoundException('رکورد موجودی یافت نشد.');
    return inv;
  }

  /** Reserve stock at order place — does not decrease quantity yet. */
  async reserveLines(manager: EntityManager, lines: LineNeed[], orderId: number) {
    if (!lines.length) throw new BadRequestException('سبد خالی است.');
    const warehouse = await this.ensureDefaultWarehouse(manager);

    for (const line of lines) {
      if (line.quantity <= 0) {
        throw new BadRequestException('تعداد نامعتبر است.');
      }
      const inv = await this.lockInventory(
        manager,
        warehouse.id,
        line.variantId,
      );
      const available = inv.quantity - inv.reservedQuantity;
      if (available < line.quantity) {
        throw new BadRequestException(
          `موجودی کافی نیست (نیاز: ${line.quantity}، موجود قابل فروش: ${Math.max(0, available)}).`,
        );
      }
      inv.reservedQuantity += line.quantity;
      await manager.getRepository(Inventory).save(inv);

      await manager.getRepository(StockMovement).save(
        manager.getRepository(StockMovement).create({
          warehouseId: warehouse.id,
          variantId: line.variantId,
          type: StockMovementType.ADJUSTMENT,
          quantity: line.quantity,
          referenceType: 'order_reserve',
          referenceId: orderId,
          note: `رزرو موجودی برای سفارش #${orderId}`,
          createdById: null,
        }),
      );
    }
  }

  /** Convert reservation into real stock OUT after successful payment. */
  async commitLines(manager: EntityManager, lines: LineNeed[], orderId: number) {
    const warehouse = await this.ensureDefaultWarehouse(manager);
    for (const line of lines) {
      const inv = await this.lockInventory(
        manager,
        warehouse.id,
        line.variantId,
      );
      if (inv.reservedQuantity < line.quantity) {
        throw new BadRequestException(
          'رزرو موجودی با اقلام سفارش هم‌خوانی ندارد.',
        );
      }
      if (inv.quantity < line.quantity) {
        throw new BadRequestException('موجودی فیزیکی برای کسر کافی نیست.');
      }
      inv.quantity -= line.quantity;
      inv.reservedQuantity -= line.quantity;
      await manager.getRepository(Inventory).save(inv);

      await manager.getRepository(StockMovement).save(
        manager.getRepository(StockMovement).create({
          warehouseId: warehouse.id,
          variantId: line.variantId,
          type: StockMovementType.OUT,
          quantity: line.quantity,
          referenceType: 'order',
          referenceId: orderId,
          note: `کسر موجودی بابت فروش سفارش #${orderId}`,
          createdById: null,
        }),
      );
    }
  }

  /** Release reservation on cancel / failed payment / admin reject. */
  async releaseLines(
    manager: EntityManager,
    lines: LineNeed[],
    orderId: number,
    reason: string,
  ) {
    const warehouse = await this.ensureDefaultWarehouse(manager);
    for (const line of lines) {
      const inv = await this.lockInventory(
        manager,
        warehouse.id,
        line.variantId,
      );
      inv.reservedQuantity = Math.max(0, inv.reservedQuantity - line.quantity);
      await manager.getRepository(Inventory).save(inv);

      await manager.getRepository(StockMovement).save(
        manager.getRepository(StockMovement).create({
          warehouseId: warehouse.id,
          variantId: line.variantId,
          type: StockMovementType.ADJUSTMENT,
          quantity: line.quantity,
          referenceType: 'order_release',
          referenceId: orderId,
          note: reason,
          createdById: null,
        }),
      );
    }
  }
}
