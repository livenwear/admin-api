import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { Role, User, UserRoleEntity } from 'src/entities';
import { AuthModule } from 'src/main/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserRoleEntity]),
    AuthModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserAdminModule {}
