import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { slugify } from 'src/common/utils/slugify';
import { Banner, FileEntity, PromoCard, PromoCardRow, Slider, SliderItem } from 'src/entities';
import { StorageService } from 'src/storage/storage.service';
import { Repository } from 'typeorm';
import {
  AdminBannerDto,
  AdminPromoCardItemDto,
  AdminPromoCardRowDto,
  AdminSliderDto,
  AdminSliderItemDto,
  AdminUpdateBannerDto,
  AdminUpdatePromoCardRowDto,
  AdminUpdateSliderDto,
  CmsListQueryDto,
} from './dto/cms.dto';

@Injectable()
export class AdminCmsService {
  constructor(
    @InjectRepository(Banner) private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(Slider) private readonly sliderRepo: Repository<Slider>,
    @InjectRepository(SliderItem)
    private readonly sliderItemRepo: Repository<SliderItem>,
    @InjectRepository(PromoCardRow)
    private readonly promoRowRepo: Repository<PromoCardRow>,
    @InjectRepository(PromoCard)
    private readonly promoCardRepo: Repository<PromoCard>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly storageService: StorageService,
  ) {}

  async listBanners(query: CmsListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.bannerRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.file', 'file')
      .orderBy('b.displayOrder', 'ASC')
      .addOrderBy('b.createdAt', 'DESC');
    if (query.position) {
      qb.andWhere('b.position = :position', { position: query.position });
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
      data: await Promise.all(rows.map((b) => this.mapBanner(b))),
      meta: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
        from: total === 0 ? 0 : (safePage - 1) * limit + 1,
        to: total === 0 ? 0 : Math.min(safePage * limit, total),
      },
    };
  }

  async createBanner(dto: AdminBannerDto) {
    const file = dto.fileUuid
      ? await this.fileRepo.findOne({ where: { uuid: dto.fileUuid } })
      : null;
    if (dto.fileUuid && !file) throw new NotFoundException('Media not found.');
    const banner = await this.bannerRepo.save(
      this.bannerRepo.create({
        title: dto.title,
        file: file || null,
        linkUrl: dto.linkUrl ?? null,
        position: dto.position ?? 'top_promo',
        displayOrder: dto.displayOrder ?? 0,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
        imageUrl: null,
      }),
    );
    const full = await this.bannerRepo.findOne({
      where: { id: banner.id },
      relations: ['file'],
    });
    return { success: true, data: await this.mapBanner(full!) };
  }

  async updateBanner(uuid: string, dto: AdminUpdateBannerDto) {
    const banner = await this.bannerRepo.findOne({
      where: { uuid },
      relations: ['file'],
    });
    if (!banner) throw new NotFoundException('Banner not found.');
    if (dto.title !== undefined) banner.title = dto.title;
    if (dto.linkUrl !== undefined) banner.linkUrl = dto.linkUrl;
    if (dto.position !== undefined) banner.position = dto.position;
    if (dto.displayOrder !== undefined) banner.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) banner.isActive = dto.isActive;
    if (dto.startsAt !== undefined)
      banner.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      banner.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.fileUuid !== undefined) {
      if (!dto.fileUuid) banner.file = null;
      else {
        const file = await this.fileRepo.findOne({
          where: { uuid: dto.fileUuid },
        });
        if (!file) throw new NotFoundException('Media not found.');
        banner.file = file;
      }
    }
    await this.bannerRepo.save(banner);
    const full = await this.bannerRepo.findOne({
      where: { uuid },
      relations: ['file'],
    });
    return { success: true, data: await this.mapBanner(full!) };
  }

  async deleteBanner(uuid: string) {
    const banner = await this.bannerRepo.findOne({ where: { uuid } });
    if (!banner) throw new NotFoundException('Banner not found.');
    await this.bannerRepo.softRemove(banner);
    return { success: true, message: 'Banner deleted' };
  }

  async listSliders() {
    const rows = await this.sliderRepo.find({
      relations: ['items', 'items.file'],
      order: { createdAt: 'DESC' },
    });
    return {
      success: true,
      data: await Promise.all(rows.map((s) => this.mapSlider(s))),
    };
  }

  async getSlider(uuid: string) {
    const slider = await this.sliderRepo.findOne({
      where: { uuid },
      relations: ['items', 'items.file'],
    });
    if (!slider) throw new NotFoundException('Slider not found.');
    return { success: true, data: await this.mapSlider(slider) };
  }

  async createSlider(dto: AdminSliderDto) {
    const slug = await this.uniqueSliderSlug(dto.slug || dto.name);
    const slider = await this.sliderRepo.save(
      this.sliderRepo.create({
        name: dto.name,
        slug,
        isActive: dto.isActive ?? true,
      }),
    );
    if (dto.items?.length) await this.syncSliderItems(slider, dto.items);
    return this.getSlider(slider.uuid);
  }

  async updateSlider(uuid: string, dto: AdminUpdateSliderDto) {
    const slider = await this.sliderRepo.findOne({ where: { uuid } });
    if (!slider) throw new NotFoundException('Slider not found.');
    if (dto.name !== undefined) slider.name = dto.name;
    if (dto.slug !== undefined)
      slider.slug = await this.uniqueSliderSlug(dto.slug, slider.id);
    if (dto.isActive !== undefined) slider.isActive = dto.isActive;
    await this.sliderRepo.save(slider);
    if (dto.items) await this.syncSliderItems(slider, dto.items, true);
    return this.getSlider(uuid);
  }

  async deleteSlider(uuid: string) {
    const slider = await this.sliderRepo.findOne({ where: { uuid } });
    if (!slider) throw new NotFoundException('Slider not found.');
    await this.sliderRepo.softRemove(slider);
    return { success: true, message: 'Slider deleted' };
  }

  async listPromoCardRows() {
    const rows = await this.promoRowRepo.find({
      relations: ['cards', 'cards.file'],
      order: { slot: 'ASC' },
    });
    return {
      success: true,
      data: await Promise.all(rows.map((r) => this.mapPromoRow(r))),
    };
  }

  async getPromoCardRow(uuid: string) {
    const row = await this.promoRowRepo.findOne({
      where: { uuid },
      relations: ['cards', 'cards.file'],
    });
    if (!row) throw new NotFoundException('Promo card row not found.');
    return { success: true, data: await this.mapPromoRow(row) };
  }

  async createPromoCardRow(dto: AdminPromoCardRowDto) {
    const count = await this.promoRowRepo.count();
    if (count >= 5) {
      throw new BadRequestException('حداکثر ۵ ردیف بنر کارت مجاز است.');
    }
    await this.assertSlotAvailable(dto.slot);
    const visibleCount = this.clampVisibleCount(dto.visibleCount ?? 5);
    const cards = (dto.cards || []).slice(0, visibleCount);
    if (cards.length > 5) {
      throw new BadRequestException('هر ردیف حداکثر ۵ کارت دارد.');
    }
    const row = await this.promoRowRepo.save(
      this.promoRowRepo.create({
        title: dto.title,
        slot: dto.slot,
        visibleCount,
        isActive: dto.isActive ?? true,
      }),
    );
    if (cards.length) await this.syncPromoCards(row, cards);
    return this.getPromoCardRow(row.uuid);
  }

  async updatePromoCardRow(uuid: string, dto: AdminUpdatePromoCardRowDto) {
    const row = await this.promoRowRepo.findOne({ where: { uuid } });
    if (!row) throw new NotFoundException('Promo card row not found.');
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.slot !== undefined) {
      await this.assertSlotAvailable(dto.slot, row.id);
      row.slot = dto.slot;
    }
    if (dto.visibleCount !== undefined) {
      row.visibleCount = this.clampVisibleCount(dto.visibleCount);
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await this.promoRowRepo.save(row);
    if (dto.cards) {
      const limit = row.visibleCount || 5;
      const cards = dto.cards.slice(0, limit);
      if (cards.length > 5) {
        throw new BadRequestException('هر ردیف حداکثر ۵ کارت دارد.');
      }
      await this.syncPromoCards(row, cards, true);
    }
    return this.getPromoCardRow(uuid);
  }

  async deletePromoCardRow(uuid: string) {
    const row = await this.promoRowRepo.findOne({ where: { uuid } });
    if (!row) throw new NotFoundException('Promo card row not found.');
    await this.promoRowRepo.softRemove(row);
    return { success: true, message: 'Promo card row deleted' };
  }

  private async assertSlotAvailable(slot: number, excludeId?: number) {
    if (slot < 1 || slot > 5) {
      throw new BadRequestException('شماره جایگاه باید بین ۱ تا ۵ باشد.');
    }
    const existing = await this.promoRowRepo.findOne({ where: { slot } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(
        `جایگاه ${slot} قبلاً توسط ردیف دیگری گرفته شده است.`,
      );
    }
  }

  private clampVisibleCount(n: number) {
    return Math.min(5, Math.max(1, Math.floor(n) || 5));
  }

  private async syncPromoCards(
    row: PromoCardRow,
    cards: AdminPromoCardItemDto[],
    replace = false,
  ) {
    if (replace) {
      await this.promoCardRepo.delete({ rowId: row.id });
    }
    for (let i = 0; i < cards.length; i++) {
      const dto = cards[i];
      const file = dto.fileUuid
        ? await this.fileRepo.findOne({ where: { uuid: dto.fileUuid } })
        : null;
      if (dto.fileUuid && !file) {
        throw new BadRequestException('تصویر کارت پیدا نشد.');
      }
      await this.promoCardRepo.save(
        this.promoCardRepo.create({
          row,
          title: dto.title ?? null,
          file: file || null,
          linkUrl: dto.linkUrl ?? null,
          displayOrder: dto.displayOrder ?? i,
          isActive: dto.isActive ?? true,
        }),
      );
    }
  }

  private async mapPromoRow(row: PromoCardRow) {
    const cards = await Promise.all(
      (row.cards || [])
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(async (card) => {
          const file = card.file as FileEntity | undefined;
          return {
            uuid: card.uuid,
            title: card.title,
            linkUrl: card.linkUrl,
            displayOrder: card.displayOrder,
            isActive: card.isActive,
            fileUuid: file?.uuid ?? null,
            imageUrl: file ? await this.safePresign(file) : null,
          };
        }),
    );
    return {
      uuid: row.uuid,
      title: row.title,
      slot: row.slot,
      visibleCount: row.visibleCount ?? 5,
      isActive: row.isActive,
      cards,
      createdAt: row.createdAt,
    };
  }

  private async syncSliderItems(
    slider: Slider,
    items: AdminSliderItemDto[],
    replace = false,
  ) {
    if (replace) {
      await this.sliderItemRepo.delete({ sliderId: slider.id });
    }
    for (let i = 0; i < items.length; i++) {
      const dto = items[i];
      const file = dto.fileUuid
        ? await this.fileRepo.findOne({ where: { uuid: dto.fileUuid } })
        : null;
      if (dto.fileUuid && !file) {
        throw new BadRequestException('Slider item media not found.');
      }
      await this.sliderItemRepo.save(
        this.sliderItemRepo.create({
          slider,
          title: dto.title ?? null,
          subtitle: dto.subtitle ?? null,
          file: file || null,
          linkUrl: dto.linkUrl ?? null,
          buttonText: dto.buttonText ?? null,
          textColor: dto.textColor ?? null,
          overlayColor: dto.overlayColor ?? null,
          displayOrder: dto.displayOrder ?? i,
          isActive: dto.isActive ?? true,
          imageUrl: null,
        }),
      );
    }
  }

  private async mapBanner(banner: Banner) {
    const file = banner.file as FileEntity | undefined;
    return {
      uuid: banner.uuid,
      title: banner.title,
      linkUrl: banner.linkUrl,
      position: banner.position,
      displayOrder: banner.displayOrder,
      startsAt: banner.startsAt,
      endsAt: banner.endsAt,
      isActive: banner.isActive,
      fileUuid: file?.uuid ?? null,
      imageUrl: file
        ? await this.safePresign(file)
        : null,
      createdAt: banner.createdAt,
    };
  }

  private async mapSlider(slider: Slider) {
    const items = await Promise.all(
      (slider.items || [])
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(async (item) => {
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
            isActive: item.isActive,
            fileUuid: file?.uuid ?? null,
            imageUrl: file ? await this.safePresign(file) : null,
          };
        }),
    );
    return {
      uuid: slider.uuid,
      name: slider.name,
      slug: slider.slug,
      isActive: slider.isActive,
      items,
      createdAt: slider.createdAt,
    };
  }

  private async safePresign(file: FileEntity) {
    try {
      return await this.storageService.getPresignedUrl(
        file.bucket,
        file.objectKey,
        3600 * 12,
      );
    } catch {
      return null;
    }
  }

  private async uniqueSliderSlug(raw: string, excludeId?: number) {
    let base = slugify(raw) || `slider-${Date.now()}`;
    let candidate = base;
    let i = 2;
    while (true) {
      const existing = await this.sliderRepo.findOne({
        where: { slug: candidate },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${i++}`;
    }
  }
}
