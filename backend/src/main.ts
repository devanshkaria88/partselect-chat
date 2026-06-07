import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();
  // The Next.js route handler proxies server-to-server, so browser CORS isn't needed;
  // permissive CORS is enabled only to ease direct curl/testing in dev.
  app.enableCors({ origin: true });

  // OpenAPI docs for the REST surface (catalog, cart, system) plus the streaming chat endpoint.
  // Swagger UI: /docs · raw spec: /docs-json
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PartSelect Agent API')
    .setDescription(
      'REST + SSE surface for the PartSelect chat agent. Grounded payloads are typed UIBlocks ' +
        'shared with the frontend via @partselect/types.',
    )
    .setVersion('0.1.0')
    .addTag('chat', 'Streaming agent turns (SSE)')
    .addTag('catalog', 'Storefront product listing and facets')
    .addTag('cart', 'Direct (agent-free) cart and simulated checkout')
    .addTag('system', 'Health, session, and trace inspection')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { tagsSorter: 'alpha', operationsSorter: 'alpha' },
  });

  const port = Number(process.env.BACKEND_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  const log = new Logger('Bootstrap');
  log.log(`PartSelect agent API listening on :${port}`);
  log.log(`OpenAPI docs at http://localhost:${port}/docs`);
}
bootstrap();
