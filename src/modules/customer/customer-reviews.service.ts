import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product, ProductVariant, Review, User } from 'src/entities';
import { ProductStatus } from 'src/entities/enums';
import { Repository } from 'typeorm';
import { CreateCustomerReviewDto } from './dto/customer-review.dto';

@Injectable()
export class CustomerReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
  ) {}

  async listMine(user: User) {
    const rows = await this.reviewRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('images.file', 'file')
      .where('r.userId = :userId', { userId: user.id })
      .orderBy('r.createdAt', 'DESC')
      .take(50)
      .getMany();

    return {
      success: true,
      data: {
        items: rows.map((r) => {
          const product = r.product as any;
          const images = (product?.images || []) as any[];
          const sorted = images
            .slice()
            .sort(
              (a, b) =>
                Number(a.displayOrder || 0) - Number(b.displayOrder || 0),
            );
          const primary =
            sorted.find((img) => img.isPrimary) || sorted[0] || null;
          const fileUuid = primary?.file?.uuid || null;
          return {
            uuid: r.uuid,
            rating: r.rating,
            title: r.title,
            body: r.body,
            isApproved: r.isApproved,
            adminReply: r.adminReply,
            repliedAt: r.repliedAt,
            createdAt: r.createdAt,
            product: product
              ? {
                  uuid: product.uuid,
                  publicId: product.publicId,
                  name: product.name,
                  slug: product.slug,
                  imageUrl: fileUuid ? `/public/media/${fileUuid}` : null,
                  fileUuid,
                }
              : null,
          };
        }),
        count: rows.length,
      },
    };
  }

  async create(user: User, productUuid: string, dto: CreateCustomerReviewDto) {
    const product = await this.productRepo.findOne({
      where: { uuid: productUuid, status: ProductStatus.ACTIVE },
    });
    if (!product) throw new NotFoundException('Product not found.');

    const existing = await this.reviewRepo.findOne({
      where: { userId: user.id, productId: product.id },
    });
    if (existing) {
      throw new ConflictException('شما قبلاً برای این محصول دیدگاه ثبت کرده‌اید.');
    }

    let variantId: number | null = null;
    if (dto.variantUuid) {
      const variant = await this.variantRepo.findOne({
        where: { uuid: dto.variantUuid, productId: product.id },
      });
      if (!variant) throw new NotFoundException('Variant not found.');
      variantId = variant.id;
    }

    const review = this.reviewRepo.create({
      userId: user.id,
      productId: product.id,
      variantId,
      rating: dto.rating,
      title: dto.title?.trim() || null,
      body: dto.body.trim(),
      isApproved: true,
    });
    const saved = await this.reviewRepo.save(review);
    await this.refreshProductRating(product.id);

    return {
      success: true,
      data: {
        uuid: saved.uuid,
        rating: saved.rating,
        title: saved.title,
        body: saved.body,
        createdAt: saved.createdAt,
        isApproved: saved.isApproved,
      },
    };
  }

  private async refreshProductRating(productId: number) {
    const row = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.productId = :productId', { productId })
      .andWhere('r.isApproved = true')
      .getRawOne<{ avg: string; cnt: string }>();

    const avg = Math.round(Number(row?.avg || 0) * 10) / 10;
    const count = Number(row?.cnt || 0);
    await this.productRepo.update(productId, {
      ratingAvg: String(avg),
      ratingCount: count,
    });
  }
}
