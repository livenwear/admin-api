import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product, Review, User } from 'src/entities';
import { Brackets, Repository } from 'typeorm';
import {
  AdminListReviewsQueryDto,
  AdminReplyReviewDto,
  AdminUpdateReviewDto,
} from './dto/admin-reviews.dto';

@Injectable()
export class AdminReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async list(query: AdminListReviewsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = ['createdAt', 'updatedAt', 'rating', 'repliedAt'].includes(
      query.sortBy || '',
    )
      ? (query.sortBy as string)
      : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .leftJoinAndSelect('r.product', 'product')
      .leftJoinAndSelect('r.repliedBy', 'repliedBy');

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('r.body ILIKE :term', { term })
            .orWhere('r.title ILIKE :term', { term })
            .orWhere('r.adminReply ILIKE :term', { term })
            .orWhere('user.firstName ILIKE :term', { term })
            .orWhere('user.lastName ILIKE :term', { term })
            .orWhere('user.phone ILIKE :term', { term })
            .orWhere('product.name ILIKE :term', { term })
            .orWhere('product.slug ILIKE :term', { term });
        }),
      );
    }

    if (query.isApproved === 'true') qb.andWhere('r.isApproved = true');
    if (query.isApproved === 'false') qb.andWhere('r.isApproved = false');

    if (query.unanswered === 'true') {
      qb.andWhere(
        new Brackets((w) => {
          w.where('r.adminReply IS NULL').orWhere("TRIM(r.adminReply) = ''");
        }),
      );
    }
    if (query.unanswered === 'false') {
      qb.andWhere('r.adminReply IS NOT NULL').andWhere(
        "TRIM(r.adminReply) <> ''",
      );
    }

    if (query.productUuid) {
      qb.andWhere('product.uuid = :productUuid', {
        productUuid: query.productUuid,
      });
    }

    qb.orderBy(`r.${sortBy}`, sortOrder);

    const total = await qb.clone().getCount();
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
      data: rows.map((r) => this.mapReview(r)),
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
    const review = await this.findOneOrFail(uuid);
    return { success: true, data: this.mapReview(review) };
  }

  async update(uuid: string, dto: AdminUpdateReviewDto, actor: User) {
    const review = await this.findOneOrFail(uuid);

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.title !== undefined) review.title = dto.title?.trim() || null;
    if (dto.body !== undefined) review.body = dto.body?.trim() || null;
    if (dto.isApproved !== undefined) review.isApproved = dto.isApproved;

    if (dto.adminReply !== undefined) {
      const reply = dto.adminReply?.trim() || null;
      review.adminReply = reply;
      if (reply) {
        review.repliedAt = new Date();
        review.repliedByUserId = actor.id;
      } else {
        review.repliedAt = null;
        review.repliedByUserId = null;
      }
    }

    await this.reviewRepo.save(review);
    await this.refreshProductRating(review.productId);
    const fresh = await this.findOneOrFail(uuid);
    return { success: true, data: this.mapReview(fresh) };
  }

  async reply(uuid: string, dto: AdminReplyReviewDto, actor: User) {
    const review = await this.findOneOrFail(uuid);
    review.adminReply = dto.body.trim();
    review.repliedAt = new Date();
    review.repliedByUserId = actor.id;
    await this.reviewRepo.save(review);
    const fresh = await this.findOneOrFail(uuid);
    return { success: true, data: this.mapReview(fresh) };
  }

  async remove(uuid: string) {
    const review = await this.findOneOrFail(uuid);
    const productId = review.productId;
    await this.reviewRepo.softRemove(review);
    await this.refreshProductRating(productId);
    return { success: true, data: { uuid } };
  }

  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [
      total,
      today,
      approved,
      pending,
      unanswered,
      avgRow,
      recent,
    ] = await Promise.all([
      this.reviewRepo.count(),
      this.reviewRepo
        .createQueryBuilder('r')
        .where('r.createdAt >= :start', { start: startOfDay })
        .getCount(),
      this.reviewRepo.count({ where: { isApproved: true } }),
      this.reviewRepo.count({ where: { isApproved: false } }),
      this.reviewRepo
        .createQueryBuilder('r')
        .where('r.adminReply IS NULL OR TRIM(r.adminReply) = :empty', {
          empty: '',
        })
        .getCount(),
      this.reviewRepo
        .createQueryBuilder('r')
        .select('AVG(r.rating)', 'avg')
        .getRawOne<{ avg: string }>(),
      this.reviewRepo.find({
        relations: ['user', 'product', 'repliedBy'],
        order: { createdAt: 'DESC' },
        take: 6,
      }),
    ]);

    return {
      total,
      today,
      approved,
      pending,
      unanswered,
      avgRating: Math.round(Number(avgRow?.avg || 0) * 10) / 10,
      recent: recent.map((r) => this.mapReview(r)),
    };
  }

  private async findOneOrFail(uuid: string) {
    const review = await this.reviewRepo.findOne({
      where: { uuid },
      relations: ['user', 'product', 'repliedBy'],
    });
    if (!review) throw new NotFoundException('Review not found.');
    return review;
  }

  private async refreshProductRating(productId: number) {
    const row = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.productId = :productId', { productId })
      .andWhere('r.isApproved = true')
      .andWhere('r.deletedAt IS NULL')
      .getRawOne<{ avg: string; cnt: string }>();

    await this.productRepo.update(productId, {
      ratingAvg: String(Math.round(Number(row?.avg || 0) * 10) / 10),
      ratingCount: Number(row?.cnt || 0),
    });
  }

  private mapReview(r: Review) {
    const user = r.user as User | undefined;
    const product = r.product as Product | undefined;
    const repliedBy = r.repliedBy as User | undefined;
    const hasReply = !!(r.adminReply && r.adminReply.trim());

    return {
      uuid: r.uuid,
      rating: r.rating,
      title: r.title,
      body: r.body,
      isApproved: r.isApproved,
      adminReply: r.adminReply,
      repliedAt: r.repliedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      hasReply,
      user: user
        ? {
            uuid: user.uuid,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email,
          }
        : null,
      product: product
        ? {
            uuid: product.uuid,
            name: product.name,
            slug: product.slug,
          }
        : null,
      repliedBy: repliedBy
        ? {
            uuid: repliedBy.uuid,
            firstName: repliedBy.firstName,
            lastName: repliedBy.lastName,
          }
        : null,
    };
  }
}
