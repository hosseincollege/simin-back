import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? [
      'http://localhost:4200',
      'https://simin-front-zeta.vercel.app',
    ],
  });
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
