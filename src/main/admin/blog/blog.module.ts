import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BlogAdminService } from './blog.service';
import { BlogAdminController } from './blog.controller';
import { AuthModule } from 'src/main/auth/auth.module';
import { User } from 'src/database/entities/user/user.entity';
import { SlugService } from 'src/common/slug.service';
import { Blog } from 'src/database/entities/blog/blog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Blog, User]),AuthModule],
  controllers: [BlogAdminController],
  providers: [BlogAdminService,SlugService],
  exports: [],
})
export class BlogAdminModule {}
