import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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
  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: (
      configService.get<string>('CORS_ORIGIN') || 'http://localhost:5173'
    )
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    methods:
      configService.get<string>('CORS_METHODS') ||
      'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders:
      configService.get<string>('CORS_HEADERS') ||
      'Content-Type,Authorization,X-Guest-Cart-Token',
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
}

bootstrap();
