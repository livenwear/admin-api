import { Module } from '@nestjs/common';
import { AuthModule } from 'src/main/auth/auth.module';
import { StorageModule } from 'src/storage';
import { StorageAdminController } from './storage-admin.controller';
import { StorageAdminService } from './storage-admin.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [StorageAdminController],
  providers: [StorageAdminService],
  exports: [StorageAdminService],
})
export class StorageAdminModule {}
