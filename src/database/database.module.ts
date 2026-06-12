import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  // imports: [
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USER'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_DB'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
     

        synchronize: true,
        migrationsRun:true,
        logging: false, 
        extra: {
          charset: 'utf8mb4_unicode_ci', 
          timeZone: 'Asia/Tehran',
        },
        options: {
          trustedConnection: true,
          encrypt: true,
          enableArithAbort: true,
          trustServerCertificate: true,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
