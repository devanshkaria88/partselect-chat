import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();
  // The Next.js route handler proxies server-to-server, so browser CORS isn't needed;
  // permissive CORS is enabled only to ease direct curl/testing in dev.
  app.enableCors({ origin: true });
  const port = Number(process.env.BACKEND_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`PartSelect agent API listening on :${port}`);
}
bootstrap();
