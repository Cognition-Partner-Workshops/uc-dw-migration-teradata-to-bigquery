import { INestApplication } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/errors/prisma-exception.filter';
import { createValidationPipe } from './common/errors/validation-exception.factory';

/** Creates the fully configured Nest application (shared by main.ts, the OpenAPI export and tests). */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  return app;
}

/**
 * Everything main.ts applies to the Nest app, also used by the test harnesses so the HTTP
 * contract (validation pipe, field-error bodies, Prisma error translation) is identical.
 */
export function configureApp(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost)));
  app.enableShutdownHooks();
}
