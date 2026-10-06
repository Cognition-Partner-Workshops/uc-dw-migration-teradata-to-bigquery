import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import './setup-env';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_JWT_SECRET, adminUser, mintAccessToken } from './support/test-users';

/** FileUtilities/SampleData callers: the test admin with the given groups (asUser() for the happy path). */
function mint(groups: string[], secret = TEST_JWT_SECRET, exp?: number): string {
  const expiresInSeconds = exp === undefined ? undefined : exp - Math.floor(Date.now() / 1000);
  return `Bearer ${mintAccessToken({ ...adminUser, groups }, { secret, expiresInSeconds })}`;
}

/** Guard + policy around POST /sample-data/import (the import itself: tests/parity/.../sample-data-controller.spec.ts). */
describe('POST /sample-data/import (http)', () => {
  let app: INestApplication;
  const tx = {
    property: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn() },
    broker: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createManyAndReturn: vi.fn() },
    contact: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    onModuleDestroy: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    tx.broker.createManyAndReturn.mockImplementation(
      ({ data }: { data: { brokerId: unknown }[] }) =>
        Promise.resolve(
          data.map((row, index) => ({ id: `broker-${index}`, brokerId: row.brokerId })),
        ),
    );
    tx.property.createMany.mockImplementation(({ data }: { data: unknown[] }) =>
      Promise.resolve({ count: data.length }),
    );
    tx.contact.createMany.mockImplementation(({ data }: { data: unknown[] }) =>
      Promise.resolve({ count: data.length }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs for a dreamhouse-admin token', async () => {
    const res = await request(app.getHttpServer())
      .post('/sample-data/import')
      .set('authorization', mint(['dreamhouse', 'dreamhouse-admin']))
      .expect(200);
    expect(res.body).toEqual({
      deleted: { properties: 0, brokers: 0, contacts: 0 },
      inserted: { brokers: 8, properties: 12, contacts: 5 },
    });
  });

  it('rejects anonymous, non-admin, badly signed and expired callers', async () => {
    const api = request(app.getHttpServer());
    await api.post('/sample-data/import').expect(401);
    await api.post('/sample-data/import').set('authorization', 'Basic abc').expect(401);
    await api
      .post('/sample-data/import')
      .set('authorization', mint(['dreamhouse']))
      .expect(403);
    await api
      .post('/sample-data/import')
      .set('authorization', mint(['dreamhouse-admin'], 'wrong'))
      .expect(401);
    await api
      .post('/sample-data/import')
      .set('authorization', mint(['dreamhouse-admin'], 'dreamhouse-characterisation', 1))
      .expect(401);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('POST /sample-data/import when SAMPLE_DATA_IMPORT_ENABLED=false', () => {
  let app: INestApplication;
  const prisma = { $transaction: vi.fn(), onModuleDestroy: vi.fn() };

  beforeAll(async () => {
    process.env.SAMPLE_DATA_IMPORT_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.SAMPLE_DATA_IMPORT_ENABLED;
    await app.close();
  });

  it('refuses even an admin with 403 and never touches the database', async () => {
    const res = await request(app.getHttpServer())
      .post('/sample-data/import')
      .set('authorization', mint(['dreamhouse-admin']))
      .expect(403);
    expect(res.body.message).toContain('SAMPLE_DATA_IMPORT_ENABLED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
