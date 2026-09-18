import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from 'src/entities';
import { LandPublicService } from './landPublic.service';
import { LandPublicController } from './landPublic.controller';
@Module({
  imports: [TypeOrmModule.forFeature([ProductCategory]),],
  controllers: [LandPublicController],
  providers: [LandPublicService],
  exports: [],
})
export class LandPublicModule {}
