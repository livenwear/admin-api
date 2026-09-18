import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BlogAdminService } from './blog.service';
import { BlogAdminController } from './blog.controller';
import { AuthModule } from 'src/main/auth/auth.module';
import { SlugService } from 'src/common/slug.service';
import { User, Blog } from 'src/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Blog, User]),AuthModule],
  controllers: [BlogAdminController],
  providers: [BlogAdminService,SlugService],
  exports: [],
})
export class BlogAdminModule {}
