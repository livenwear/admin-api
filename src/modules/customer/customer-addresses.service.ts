import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address, User } from 'src/entities';
import { Repository } from 'typeorm';
import { AddressCreateDto, AddressUpdateDto } from './dto/address.dto';

@Injectable()
export class CustomerAddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
  ) {}

  private map(row: Address) {
    return {
      uuid: row.uuid,
      title: row.title,
      province: row.province,
      city: row.city,
      addressLine1: row.addressLine1,
      plaque: row.plaque,
      unit: row.unit,
      postalCode: row.postalCode,
      isDefault: row.isDefault,
      phone: row.phone,
      firstName: row.firstName,
      lastName: row.lastName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async listEntities(userId: number) {
    return this.addressRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
  }

  async list(user: User) {
    const rows = await this.listEntities(user.id);
    return {
      success: true,
      data: {
        items: rows.map((r) => this.map(r)),
        count: rows.length,
      },
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

  private buildTitle(dto: { title?: string; city?: string; plaque?: string }) {
    if (dto.title?.trim()) return dto.title.trim();
    const city = dto.city?.trim() || 'آدرس';
    const plaque = dto.plaque?.trim();
    return plaque ? `${city} — پلاک ${plaque}` : city;
  }

  async create(user: User, dto: AddressCreateDto) {
    const existing = await this.listEntities(user.id);
    const makeDefault = dto.isDefault === true || existing.length === 0;

    if (makeDefault) {
      await this.clearDefaults(user.id);
    }

    const row = await this.addressRepo.save(
      this.addressRepo.create({
        userId: user.id,
        title: this.buildTitle(dto),
        firstName: user.firstName?.trim() || '—',
        lastName: user.lastName?.trim() || '—',
        phone: user.phone || null,
        country: 'IR',
        province: dto.province.trim(),
        city: dto.city.trim(),
        addressLine1: dto.addressLine1.trim(),
        addressLine2: null,
        plaque: dto.plaque.trim(),
        unit: dto.unit?.trim() || null,
        postalCode: dto.postalCode.trim(),
        isDefault: makeDefault,
      }),
    );

    return { success: true, data: this.map(row) };
  }

  private async findOwned(user: User, uuid: string) {
    const row = await this.addressRepo.findOne({
      where: { uuid, userId: user.id },
    });
    if (!row) throw new NotFoundException('آدرس یافت نشد.');
    return row;
  }

  async update(user: User, uuid: string, dto: AddressUpdateDto) {
    const row = await this.findOwned(user, uuid);

    if (dto.province != null) row.province = dto.province.trim();
    if (dto.city != null) row.city = dto.city.trim();
    if (dto.addressLine1 != null) row.addressLine1 = dto.addressLine1.trim();
    if (dto.plaque != null) row.plaque = dto.plaque.trim();
    if (dto.unit !== undefined) row.unit = dto.unit?.trim() || null;
    if (dto.postalCode != null) row.postalCode = dto.postalCode.trim();
    if (dto.title != null) row.title = dto.title.trim() || row.title;

    if (!row.title || dto.city || dto.plaque) {
      row.title = this.buildTitle({
        title: dto.title ?? row.title ?? undefined,
        city: row.city ?? undefined,
        plaque: row.plaque ?? undefined,
      });
    }

    if (dto.isDefault === true) {
      await this.clearDefaults(user.id, row.id);
      row.isDefault = true;
    }

    const saved = await this.addressRepo.save(row);
    return { success: true, data: this.map(saved) };
  }

  async setDefault(user: User, uuid: string) {
    const row = await this.findOwned(user, uuid);
    await this.clearDefaults(user.id, row.id);
    row.isDefault = true;
    const saved = await this.addressRepo.save(row);
    return { success: true, data: this.map(saved) };
  }

  async remove(user: User, uuid: string) {
    const row = await this.findOwned(user, uuid);
    const wasDefault = row.isDefault;
    await this.addressRepo.softRemove(row);

    if (wasDefault) {
      const next = await this.addressRepo.findOne({
        where: { userId: user.id },
        order: { updatedAt: 'DESC' },
      });
      if (next) {
        next.isDefault = true;
        await this.addressRepo.save(next);
      }
    }

    return { success: true, message: 'آدرس حذف شد' };
  }
}
