import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { SeedModule } from './database/seed.module';
import { ThrottlerModule, ThrottlerModuleOptions, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { CustomerModule } from './modules/customer/customer.module';
import { PublicModule } from './modules/public/public.module';
import { StorageModule } from './storage/storage.module';
import { ChatModule } from './modules/chat/chat.module';
import { OrdersModule } from './modules/orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (
        configService: ConfigService,
      ): Promise<ThrottlerModuleOptions> => [
        {
          ttl: Number(configService.get<string>('THROTTLE_TTL', '6000')),
          limit: Number(configService.get<string>('THROTTLE_LIMIT', '10')),
        },
      ],
      inject: [ConfigService],
    }),
    DatabaseModule,
    SeedModule,
    StorageModule,
    AuthModule,
    AdminModule,
    CustomerModule,
    PublicModule,
    ChatModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
