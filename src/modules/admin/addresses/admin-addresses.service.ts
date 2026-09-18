import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address, User } from 'src/entities';
import { Repository } from 'typeorm';
import {
  AdminListAddressesQueryDto,
  AdminUpdateAddressDto,
} from './dto/admin-addresses.dto';

@Injectable()
export class AdminAddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
  ) {}

  private map(row: Address & { user?: User | null }) {
    const user = row.user;
    return {
      uuid: row.uuid,
      title: row.title,
      province: row.province,
      city: row.city,
      addressLine1: row.addressLine1,
      plaque: row.plaque,
      unit: row.unit,
      postalCode: row.postalCode,
      phone: row.phone,
      firstName: row.firstName,
      lastName: row.lastName,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: user
        ? {
            uuid: user.uuid,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email,
          }
        : null,
    };
  }

  private async clearDefaults(userId: number, exceptId?: number) {
    const qb = this.addressRepo
      .createQueryBuilder()
      .update(Address)
      .set({ isDefault: false })
      .where('"user_id" = :userId', { userId })
      .andWhere('"isDefault" = true');
    if (exceptId) {
      qb.andWhere('id != :exceptId', { exceptId });
    }
    await qb.execute();
  }

  async list(query: AdminListAddressesQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const sortBy = query.sortBy || 'updatedAt';
    const sortOrder = query.sortOrder || 'DESC';

    const qb = this.addressRepo
      .createQueryBuilder('address')
      .leftJoinAndSelect('address.user', 'user');

    if (query.search?.trim()) {
      const q = `%${query.search.trim()}%`;
      qb.andWhere(
        `(address.province ILIKE :q
          OR address.city ILIKE :q
          OR address.addressLine1 ILIKE :q
          OR address.plaque ILIKE :q
          OR address.postalCode ILIKE :q
          OR address.phone ILIKE :q
          OR address.title ILIKE :q
          OR user.phone ILIKE :q
          OR user.firstName ILIKE :q
          OR user.lastName ILIKE :q)`,
        { q },
      );
    }

    if (query.isDefault === 'true') {
      qb.andWhere('address.isDefault = true');
    } else if (query.isDefault === 'false') {
      qb.andWhere('address.isDefault = false');
    }

    const sortColumn =
      sortBy === 'city'
        ? 'address.city'
        : sortBy === 'province'
          ? 'address.province'
          : sortBy === 'createdAt'
            ? 'address.createdAt'
            : 'address.updatedAt';

    qb.orderBy(sortColumn, sortOrder).addOrderBy('address.id', 'DESC');

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
      data: rows.map((row) => this.map(row)),
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

  async update(uuid: string, dto: AdminUpdateAddressDto) {
    const row = await this.addressRepo.findOne({
      where: { uuid },
      relations: ['user'],
    });
    if (!row) throw new NotFoundException('آدرس یافت نشد.');

    if (dto.province != null) row.province = dto.province.trim();
    if (dto.city != null) row.city = dto.city.trim();
    if (dto.addressLine1 != null) row.addressLine1 = dto.addressLine1.trim();
    if (dto.plaque != null) row.plaque = dto.plaque.trim();
    if (dto.unit !== undefined) row.unit = dto.unit?.trim() || null;
    if (dto.postalCode != null) row.postalCode = dto.postalCode.trim();
    if (dto.title !== undefined) {
      row.title = dto.title?.trim() || null;
    }
    if (dto.phone !== undefined) {
      row.phone = dto.phone?.trim() || null;
    }

    if (!row.title || dto.city || dto.plaque || dto.title !== undefined) {
      const city = row.city?.trim() || 'آدرس';
      const plaque = row.plaque?.trim();
      if (!dto.title?.trim()) {
        row.title = plaque ? `${city} — پلاک ${plaque}` : city;
      }
    }

    if (dto.isDefault === true) {
      await this.clearDefaults(row.userId, row.id);
      row.isDefault = true;
    } else if (dto.isDefault === false) {
      row.isDefault = false;
    }

    const saved = await this.addressRepo.save(row);
    const full = await this.addressRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    return {
      success: true,
      message: 'آدرس به‌روزرسانی شد',
      data: this.map(full || saved),
    };
  }
}
