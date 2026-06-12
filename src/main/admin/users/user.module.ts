import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from 'src/database/entities/user/user.entity';
import { AuthModule } from 'src/main/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]),AuthModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserAdminModule {}
