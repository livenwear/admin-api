import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken, Role, User, UserRoleEntity, ImpersonationGrant } from 'src/entities';
import { AdminAuthController } from './admin/admin-auth.controller';
import { AdminAuthService } from './admin/admin-auth.service';
import { CustomerAuthController } from './customer/customer-auth.controller';
import { CustomerAuthService } from './customer/customer-auth.service';
import { JwtAuthGuard } from './shared/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './shared/optional-jwt-auth.guard';
import { OtpService } from './shared/otp.service';
import { TokenService } from './shared/token.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      UserRoleEntity,
      RefreshToken,
      ImpersonationGrant,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET_KEY'),
      }),
    }),
  ],
  controllers: [AdminAuthController, CustomerAuthController],
  providers: [
    TokenService,
    OtpService,
    AdminAuthService,
    CustomerAuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [TokenService, JwtAuthGuard, OptionalJwtAuthGuard, JwtModule, OtpService],
})
export class AuthModule {}
