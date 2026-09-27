import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from 'src/entities';
import { MediaFilesService } from './media-files.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([FileEntity])],
  providers: [StorageService, MediaFilesService],
  exports: [StorageService, MediaFilesService],
})
export class StorageModule {}
