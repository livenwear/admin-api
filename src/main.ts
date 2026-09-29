import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { CustomExceptionFilter } from './filters/custom-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new CustomExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configService = app.get(ConfigService);
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'mylog', method: RequestMethod.GET }],
  });

  app.enableCors({
    origin: (
      configService.get<string>('CORS_ORIGIN') ||
      'http://localhost:5173,http://localhost:3000,https://livenmode.ir,https://www.livenmode.ir,https://console.livenmode.ir'
    )
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    methods:
      configService.get<string>('CORS_METHODS') ||
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      configService.get<string>('CORS_HEADERS') ||
      'Content-Type,Authorization,X-Guest-Cart-Token,X-Torob-Token,X-Torob-Token-Version',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Liven API')
    .setDescription(
      'Liven clothing store API — public / customer panel / admin',
    )
    .setVersion('1.0')
    .addTag('admin-auth')
    .addTag('customer-auth')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/api`);
  console.log(`Live logs: http://localhost:${port}/mylog`);
}

bootstrap();
