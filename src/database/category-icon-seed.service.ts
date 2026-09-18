import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { Category, FileEntity } from 'src/entities';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';

const ICON_KEYS = [
  'tshirt',
  'pants',
  'hoodie',
  'shoes',
  'dress',
  'bag',
  'set',
  'kids',
] as const;

type IconKey = (typeof ICON_KEYS)[number];

/** Map category title/slug keywords → icon */
function pickIconKey(title: string, slug: string): IconKey {
  const hay = `${title} ${slug}`.toLowerCase();
  if (/تیشرت|tshirt|t-shirt|tee/.test(hay)) return 'tshirt';
  if (/شلوار|pants|jeans|شلوارک/.test(hay)) return 'pants';
  if (/هودی|hoodie|سویشرت|sweat/.test(hay)) return 'hoodie';
  if (/کفش|shoe|sneaker/.test(hay)) return 'shoes';
  if (/پیراهن|dress|مانتو|دامن/.test(hay)) return 'dress';
  if (/کیف|bag|اکسسور|access/.test(hay)) return 'bag';
  if (/ست|set|کالکشن/.test(hay)) return 'set';
  if (/بچ|کودک|kids|child/.test(hay)) return 'kids';
  // stable rotate by slug hash
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash + slug.charCodeAt(i) * 17) % ICON_KEYS.length;
  return ICON_KEYS[hash];
}

@Injectable()
export class CategoryIconSeedService implements OnModuleInit {
  private readonly logger = new Logger(CategoryIconSeedService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureCategorySvgLogos();
    } catch (err) {
      this.logger.warn(
        `Category SVG logo seed skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private iconsDir() {
    const candidates = [
      join(process.cwd(), 'assets', 'category-icons'),
      join(process.cwd(), 'api', 'assets', 'category-icons'),
      join(__dirname, '..', '..', 'assets', 'category-icons'),
    ];
    return candidates.find((p) => existsSync(p)) || null;
  }

  private async ensureCategorySvgLogos() {
    const dir = this.iconsDir();
    if (!dir) {
      this.logger.warn('category-icons folder not found — skip logo seed');
      return;
    }

    const available = new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith('.svg'))
        .map((f) => f.replace(/\.svg$/i, '')),
    );

    const categories = await this.categoryRepo.find({
      where: { isActive: true },
    });

    let assigned = 0;
    for (const cat of categories) {
      if (cat.imageUrl) continue;
      const key = pickIconKey(cat.title, cat.slug);
      const fileName = available.has(key)
        ? `${key}.svg`
        : available.has('tshirt')
          ? 'tshirt.svg'
          : [...available][0]
            ? `${[...available][0]}.svg`
            : null;
      if (!fileName) continue;

      const buffer = readFileSync(join(dir, fileName));
      const stored = await this.storageService.upload(
        buffer,
        fileName,
        'image/svg+xml',
        {
          namespace: StorageNamespace.PRODUCT_CATEGORIES,
          entityId: cat.uuid,
          generateThumbnails: false,
        },
      );

      const row = await this.fileRepo.save(
        this.fileRepo.create({
          bucket: stored.bucket,
          objectKey: stored.objectKey,
          namespace: stored.namespace,
          originalName: stored.originalName,
          mimeType: 'image/svg+xml',
          size: String(stored.size),
          extension: 'svg',
          publicUrl: '',
          entityId: cat.uuid,
          variant: stored.variant || null,
          metadata: { storageFileId: stored.fileId, seeded: true },
          isPublic: false,
        }),
      );

      cat.imageUrl = `file://${row.uuid}`;
      await this.categoryRepo.save(cat);
      assigned += 1;
    }

    if (assigned > 0) {
      this.logger.log(`Seeded SVG logos for ${assigned} categories`);
    }
  }
}
