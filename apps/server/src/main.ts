import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { trpcMiddleware } from './trpc/trpc.middleware.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim());

  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-trpc-source'],
  });

  // Монтируем tRPC поверх Express-инстанса Nest.
  app.use('/trpc', trpcMiddleware);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚚 Altay Logistik API готов на http://localhost:${port} (tRPC: /trpc)`);
}

bootstrap();
