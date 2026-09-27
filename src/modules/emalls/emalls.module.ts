import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, Setting } from 'src/entities';
import { EmallsAuthService } from './emalls-auth.service';
import { EmallsController } from './emalls.controller';
import { EmallsService } from './emalls.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Setting])],
  controllers: [EmallsController],
  providers: [EmallsService, EmallsAuthService],
})
export class EmallsModule {}
