import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.factory';
import { AppConfigService } from '../../src/config/app-config.service';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestingAppOptions {
  /** Wrap the real PrismaService (e.g. to route every query through a test transaction). */
  wrapPrisma?: (prisma: PrismaService) => PrismaService;
}

/**
 * Boots the full AppModule the way main.ts does (same pipes, prefix, CORS),
 * but lets test suites substitute the Prisma client. Used by app/api/test and
 * by the characterisation specs under tests/parity.
 */
export async function createTestingApp(options: TestingAppOptions = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.wrapPrisma) {
    const wrapPrisma = options.wrapPrisma;
    builder.overrideProvider(PrismaService).useFactory({
      factory: (config: AppConfigService) => wrapPrisma(new PrismaService(config)),
      inject: [AppConfigService],
    });
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

export { PrismaService };
export type { INestApplication };
