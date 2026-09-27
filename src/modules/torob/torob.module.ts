import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from 'src/entities';
import { TorobAuthGuard } from './torob-auth.guard';
import { TorobController } from './torob.controller';
import { TorobService } from './torob.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [TorobController],
  providers: [TorobService, TorobAuthGuard],
})
export class TorobModule {}
