import { INestApplication } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './auth/request-context';
import { PrismaExceptionFilter } from './common/errors/prisma-exception.filter';
import { createValidationPipe } from './common/errors/validation-exception.factory';
import { AppConfigService } from './config/app-config.service';

/** Creates the fully configured Nest application (shared by main.ts, the OpenAPI export and tests). */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  return app;
}

/**
 * Everything main.ts applies to the Nest app, also used by the test harnesses so the HTTP
 * contract (request context for sharing, validation pipe, field-error bodies, Prisma error
 * translation) is identical. Guards and the field-security interceptor come from AuthModule.
 */
export function configureApp(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  // POST /files carries the file body as base64 JSON (FileUtilities.createFile): size the JSON
  // parser for FILES_MAX_INLINE_BYTES of decoded content (4/3 overhead) plus the other fields.
  const maxInlineBytes = app.get(AppConfigService).get('FILES_MAX_INLINE_BYTES');
  (app as NestExpressApplication).useBodyParser('json', {
    limit: Math.ceil((maxInlineBytes * 4) / 3) + 64 * 1024,
  });
  app.use(requestContextMiddleware);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost)));
  app.enableShutdownHooks();
}
