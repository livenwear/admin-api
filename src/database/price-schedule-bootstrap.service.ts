import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Price } from 'src/entities';
import { Repository } from 'typeorm';

/**
 * Backfill `effectiveFrom` for legacy price rows created before scheduling existed.
 */
@Injectable()
export class PriceScheduleBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PriceScheduleBootstrapService.name);

  constructor(
    @InjectRepository(Price) private readonly priceRepo: Repository<Price>,
  ) {}

  async onModuleInit() {
    try {
      const result = await this.priceRepo
        .createQueryBuilder()
        .update(Price)
        .set({ effectiveFrom: () => '"createdAt"' })
        .where('"effectiveFrom" IS NULL')
        .andWhere('"deletedAt" IS NULL')
        .execute();
      const n = result.affected ?? 0;
      if (n > 0) {
        this.logger.log(`Backfilled effectiveFrom on ${n} price row(s)`);
      }
    } catch (err) {
      this.logger.warn(
        `Price effectiveFrom backfill skipped: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
}
