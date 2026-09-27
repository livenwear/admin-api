import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  FileEntity,
  Price,
  PromoCard,
  PromoCardRow,
  Role,
  User,
  UserRoleEntity,
} from 'src/entities';
import { CategoryIconSeedService } from './category-icon-seed.service';
import { PriceScheduleBootstrapService } from './price-schedule-bootstrap.service';
import { PromoCardSeedService } from './promo-card-seed.service';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      UserRoleEntity,
      Category,
      FileEntity,
      PromoCardRow,
      PromoCard,
      Price,
    ]),
  ],
  providers: [
    SeedService,
    CategoryIconSeedService,
    PromoCardSeedService,
    PriceScheduleBootstrapService,
  ],
})
export class SeedModule {}
