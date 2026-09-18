import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  FileEntity,
  PromoCard,
  PromoCardRow,
  Role,
  User,
  UserRoleEntity,
} from 'src/entities';
import { CategoryIconSeedService } from './category-icon-seed.service';
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
    ]),
  ],
  providers: [SeedService, CategoryIconSeedService, PromoCardSeedService],
})
export class SeedModule {}
