import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { FileEntity, PromoCard, PromoCardRow } from 'src/entities';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';

const ROW_DEFS = [
  {
    title: 'پیشنهادهای ویژه ۱',
    slot: 1,
    cards: [
      { title: 'پوشاک زنانه', link: '/categories', color: ['#E8DFC8', '#C4A574'] },
      { title: 'تی‌شرت‌ها', link: '/gallery', color: ['#F0F0DB', '#ACBAC4'] },
      { title: 'شگفت‌انگیز', link: '/amazing', color: ['#FFE4E9', '#E11D48'] },
      { title: 'پرفروش‌ها', link: '/bestsellers', color: ['#E8ECF4', '#30364F'] },
      { title: 'کالکشن جدید', link: '/categories', color: ['#D4E8E4', '#2A6B63'] },
    ],
  },
  {
    title: 'پیشنهادهای ویژه ۲',
    slot: 2,
    cards: [
      { title: 'استایل روزانه', link: '/gallery', color: ['#F5E6D3', '#8B5E3C'] },
      { title: 'اکسسوری', link: '/categories', color: ['#EDE9FE', '#5B4B8A'] },
      { title: 'فصل جدید', link: '/amazing', color: ['#DCFCE7', '#166534'] },
      { title: 'تخفیف طلایی', link: '/bestsellers', color: ['#FEF3C7', '#B45309'] },
      { title: 'ست کامل', link: '/categories', color: ['#FCE7F3', '#9D174D'] },
    ],
  },
  {
    title: 'پیشنهادهای ویژه ۳',
    slot: 3,
    cards: [
      { title: 'مینیمال', link: '/gallery', color: ['#F3F4F6', '#374151'] },
      { title: 'ورزشی', link: '/categories', color: ['#DBEAFE', '#1D4ED8'] },
      { title: 'رسمی', link: '/bestsellers', color: ['#1F2937', '#9CA3AF'] },
      { title: 'کژوال', link: '/amazing', color: ['#FEF9C3', '#854D0E'] },
      { title: 'بچه‌گانه', link: '/categories', color: ['#FCE7F3', '#BE185D'] },
    ],
  },
  {
    title: 'پیشنهادهای ویژه ۴',
    slot: 4,
    cards: [
      { title: 'هودی', link: '/categories', color: ['#30364F', '#E1D9BC'] },
      { title: 'شلوار', link: '/gallery', color: ['#242938', '#ACBAC4'] },
      { title: 'کفش', link: '/bestsellers', color: ['#3d445e', '#F0F0DB'] },
      { title: 'کیف', link: '/amazing', color: ['#4A5568', '#E2E8F0'] },
      { title: 'همه دسته‌ها', link: '/categories', color: ['#E11D48', '#F0F0DB'] },
    ],
  },
] as const;

@Injectable()
export class PromoCardSeedService implements OnModuleInit {
  private readonly logger = new Logger(PromoCardSeedService.name);

  constructor(
    @InjectRepository(PromoCardRow)
    private readonly rowRepo: Repository<PromoCardRow>,
    @InjectRepository(PromoCard)
    private readonly cardRepo: Repository<PromoCard>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureSampleRows();
    } catch (err) {
      this.logger.warn(
        `Promo card seed skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async ensureSampleRows() {
    const existing = await this.rowRepo.count();
    if (existing > 0) {
      this.logger.debug('Promo card rows already present — skip seed');
      return;
    }

    let totalCards = 0;
    for (const def of ROW_DEFS) {
      const row = await this.rowRepo.save(
        this.rowRepo.create({
          title: def.title,
          slot: def.slot,
          visibleCount: 5,
          isActive: true,
        }),
      );

      for (let i = 0; i < def.cards.length; i++) {
        const cardDef = def.cards[i];
        const buffer = await this.makeCardJpeg(
          cardDef.title,
          cardDef.color[0],
          cardDef.color[1],
          def.slot,
          i + 1,
        );
        const stored = await this.storageService.upload(
          buffer,
          `promo-s${def.slot}-c${i + 1}.jpg`,
          'image/jpeg',
          {
            namespace: StorageNamespace.PROMO_CARDS,
            entityId: row.uuid,
            generateThumbnails: true,
          },
        );
        const file = await this.fileRepo.save(
          this.fileRepo.create({
            bucket: stored.bucket,
            objectKey: stored.objectKey,
            namespace: stored.namespace,
            originalName: stored.originalName,
            mimeType: 'image/jpeg',
            size: String(stored.size),
            extension: 'jpg',
            publicUrl: '',
            entityId: row.uuid,
            variant: stored.variant || null,
            metadata: { storageFileId: stored.fileId, seeded: true },
            isPublic: false,
          }),
        );
        await this.cardRepo.save(
          this.cardRepo.create({
            row,
            title: cardDef.title,
            file,
            linkUrl: cardDef.link,
            displayOrder: i,
            isActive: true,
          }),
        );
        totalCards += 1;
      }
    }

    this.logger.log(
      `Seeded ${ROW_DEFS.length} promo card rows (${totalCards} cards) on MinIO`,
    );
  }

  private async makeCardJpeg(
    label: string,
    c1: string,
    c2: string,
    slot: number,
    index: number,
  ) {
    const svg = `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="800" rx="48" fill="url(#g)"/>
      <circle cx="640" cy="160" r="120" fill="rgba(255,255,255,0.12)"/>
      <circle cx="140" cy="680" r="180" fill="rgba(0,0,0,0.08)"/>
      <text x="60" y="700" fill="rgba(255,255,255,0.95)" font-size="42" font-family="Tahoma, Arial" font-weight="700">${escapeXml(label)}</text>
      <text x="60" y="750" fill="rgba(255,255,255,0.55)" font-size="22" font-family="Tahoma, Arial">Liven · ردیف ${slot} · کارت ${index}</text>
    </svg>`;
    return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  }
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
