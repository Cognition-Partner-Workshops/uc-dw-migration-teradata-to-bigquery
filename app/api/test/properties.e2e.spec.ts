import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { asUser, standardUser } from './support/test-users';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import './setup-env';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { Prisma } from '../src/generated/prisma/client';
import { CACHEABLE } from '../src/modules/properties/properties.controller';
import { PrismaService } from '../src/prisma/prisma.service';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';

/**
 * HTTP surface of the PropertyController port with Prisma stubbed out (the real
 * database round-trip is covered by tests/parity/characterisation/property-controller.spec.ts).
 */
describe('GET /properties, GET /properties/:id/pictures (http)', () => {
  let app: INestApplication;
  const prisma = {
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    property: { count: vi.fn(), findMany: vi.fn() },
    file: { findMany: vi.fn() },
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
    prisma.property.count.mockReset().mockResolvedValue(1);
    prisma.property.findMany.mockReset().mockResolvedValue([
      {
        id: PROPERTY_ID,
        name: 'Name 0',
        address: '18 Henry St',
        city: 'Cambridge',
        state: 'MA',
        description: null,
        price: new Prisma.Decimal('20000.00'),
        baths: 3,
        beds: 3,
        thumbnail: null,
        locationLatitude: new Prisma.Decimal('42.3600825'),
        locationLongitude: new Prisma.Decimal('-71.0588801'),
      },
    ]);
    prisma.file.findMany.mockReset().mockResolvedValue([]);
  });

  // Requests run as the Standard User + `dreamhouse` permission set (TestPropertyController runAs).
  const http = () => request.agent(app.getHttpServer()).set(asUser(standardUser));

  afterAll(async () => {
    await app.close();
  });

  it('returns the Apex PagedResult shape, defaults omitted filters like the Apex method and caches', async () => {
    const res = await http().get('/properties?searchKey=cam').expect(200);
    expect(res.headers['cache-control']).toBe(CACHEABLE);
    expect(res.headers.etag).toBeDefined();
    expect(res.body).toEqual({
      pageSize: 9,
      pageNumber: 1,
      totalItemCount: 1,
      records: [
        {
          id: PROPERTY_ID,
          name: 'Name 0',
          address: '18 Henry St',
          city: 'Cambridge',
          state: 'MA',
          description: null,
          price: 20000,
          baths: 3,
          beds: 3,
          thumbnail: null,
          latitude: 42.3600825,
          longitude: -71.0588801,
        },
      ],
    });
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ city: { contains: 'cam', mode: 'insensitive' } }]),
          price: { lte: 9999999 },
          beds: { gte: 0 },
          baths: { gte: 0 },
        }),
        take: 9,
        skip: 0,
      }),
    );
  });

  it('coerces and forwards the paging / filter query parameters', async () => {
    await http()
      .get('/properties?maxPrice=500000&minBedrooms=2&minBathrooms=1&pageSize=10&pageNumber=3')
      .expect(200);
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          price: { lte: 500000 },
          beds: { gte: 2 },
          baths: { gte: 1 },
        }),
        take: 10,
        skip: 20,
      }),
    );
  });

  it('answers 304 to a conditional refetch of an unchanged page', async () => {
    const first = await http().get('/properties').expect(200);
    await http().get('/properties').set('If-None-Match', first.headers.etag).expect(304);
  });

  it('serves pictures as [] when none are linked, with the same caching', async () => {
    const res = await http().get(`/properties/${PROPERTY_ID}/pictures`).expect(200);
    expect(res.headers['cache-control']).toBe(CACHEABLE);
    expect(res.body).toEqual([]);
    expect(prisma.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recordId: PROPERTY_ID, fileType: { in: ['PNG', 'JPG', 'GIF'] } },
      }),
    );
  });

  it('rejects a non-UUID property id', async () => {
    await http().get('/properties/a0x5e000001abc/pictures').expect(400);
  });
});
