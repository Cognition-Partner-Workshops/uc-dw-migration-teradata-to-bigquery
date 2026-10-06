import { createTestingApp, type INestApplication } from 'dreamhouse-api/test/support/testing-app';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { TransactionalPrisma } from './transactional-prisma';

export interface ApiTestContext {
  /** supertest agent bound to the booted Nest app (no global prefix; the web proxies /api to it). */
  readonly api: () => ReturnType<typeof supertest>;
  /** Transaction-scoped Prisma client for fixtures. */
  readonly prisma: TransactionalPrisma;
}

/**
 * Boots the real API once per spec file and opens a rolled-back database
 * transaction around every test, mirroring the Apex test context
 * (each @IsTest method sees only its own data and leaves no trace).
 */
export function useApiTestContext(): ApiTestContext {
  let app: INestApplication | undefined;
  let prisma: TransactionalPrisma | undefined;

  beforeAll(async () => {
    app = await createTestingApp({
      wrapPrisma: (real) => {
        prisma = new TransactionalPrisma(real);
        return prisma.client;
      },
    });
  });

  beforeEach(async () => {
    await prisma!.begin();
  });

  afterEach(async () => {
    await prisma?.rollback();
  });

  afterAll(async () => {
    await prisma?.rollback();
    await app?.close();
  });

  return {
    api: () => supertest(app!.getHttpServer()),
    get prisma() {
      if (!prisma) throw new Error('API test context is not booted yet (use inside a test)');
      return prisma;
    },
  };
}
