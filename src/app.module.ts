


import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Import ConfigService
import { DatabaseModule } from './database/database.module';
import { UserAdminModule } from './main/admin/users/user.module';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler'; // Import ThrottlerModuleOptions
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './main/auth/auth.module';
import { JwtAuthGuard } from './main/auth/strategies/jwt.strategy';
// import { BlogAdminModule } from './main/admin/blog/blog.module';
import { ProductCategoryAdminModule } from './main/admin/ProudctCategory/ProductCategoryAdmin.module';
import { LandPublicModule } from './main/land/landPublic.module';
import { ProductAdminModule } from './main/admin/product/product.module';

@Module({
  imports: [
    
    ConfigModule.forRoot({
      isGlobal: true, 
      envFilePath: '.env',  // Load from the .env file
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],  // Make ConfigModule available to this module
      useFactory: async (configService: ConfigService): Promise<ThrottlerModuleOptions> => ([{
        ttl: Number(configService.get<string>('THROTTLE_TTL', '6000')),  // Ensure TTL is a number, default 6000
        limit: Number(configService.get<string>('THROTTLE_LIMIT', '10')),      }]),
      inject: [ConfigService],  // Inject ConfigService into the factory function
    }),
    AuthModule,
    DatabaseModule,
    UserAdminModule,
    // BlogAdminModule,
    ProductAdminModule, 
    LandPublicModule,
    ProductCategoryAdminModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
   
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,  // Use ThrottlerGuard globally
    },
  ],
})
export class AppModule {}
