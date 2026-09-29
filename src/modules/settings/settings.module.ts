import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting, User } from 'src/entities';
import { AdminAppSettingsController } from './admin-app-settings.controller';
import { AppSettingsService } from './app-settings.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting, User])],
  controllers: [AdminAppSettingsController],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class SettingsModule {}
