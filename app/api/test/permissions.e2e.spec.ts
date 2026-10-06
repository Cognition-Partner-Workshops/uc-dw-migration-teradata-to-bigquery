import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import './setup-env';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { fieldAccess } from '../src/auth/field-policy';
import { readPermissionSet } from '../src/auth/salesforce-metadata.test-support';
import { Prisma } from '../src/generated/prisma/client';
import { GeocodingService } from '../src/modules/geocoding/geocoding.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  adminUser,
  asUser,
  guestUser,
  mintAccessToken,
  otherGroupUser,
  standardUser,
  type TestUser,
} from './support/test-users';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const BROKER_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-06T08:00:00.000Z');

const propertyRow = (overrides: Record<string, unknown> = {}) => ({
  id: PROPERTY_ID,
  sfId: null,
  name: 'Stunning Victorian',
  address: '18 Henry St',
  city: 'Cambridge',
  state: 'MA',
  zip: '01742',
  description: null,
  tags: null,
  price: new Prisma.Decimal('975000'),
  priceSold: null,
  assessedValue: null,
  beds: 3,
  baths: 2,
  status: 'Available',
  dateListed: null,
  datePreMarket: null,
  dateContracted: null,
  dateAgreement: null,
  dateClosed: null,
  locationLatitude: null,
  locationLongitude: null,
  picture: null,
  thumbnail: null,
  brokerId: null,
  ownerId: null,
  createdBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});
const brokerRow = (overrides: Record<string, unknown> = {}) => ({
  id: BROKER_ID,
  sfId: null,
  name: 'Caroline Kingsley',
  brokerId: null,
  title: null,
  phone: null,
  mobilePhone: null,
  email: null,
  picture: null,
  ownerId: null,
  createdBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});
const contactRow = (overrides: Record<string, unknown> = {}) => ({
  id: CONTACT_ID,
  sfId: null,
  firstName: 'Amy',
  lastName: 'Taylor',
  email: null,
  phone: null,
  mobilePhone: null,
  title: null,
  mailingStreet: null,
  mailingCity: null,
  mailingState: null,
  mailingPostalCode: null,
  mailingCountry: null,
  ownerId: 'test-standarduser',
  createdBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

type Verb = 'get' | 'post' | 'patch' | 'delete';

/** One cell of the matrix: what the route is in Salesforce terms and what it answers when allowed. */
interface RouteUnderTest {
  object: string;
  operation: string;
  verb: Verb;
  path: string;
  body?: Record<string, unknown>;
  /** Status when the caller is permitted (501 = ported later, but authorised). */
  allowedStatus: number;
}

const ROUTES: RouteUnderTest[] = [
  {
    object: 'Property__c',
    operation: 'read',
    verb: 'get',
    path: '/properties',
    allowedStatus: 200,
  },
  {
    object: 'Property__c',
    operation: 'read',
    verb: 'get',
    path: `/properties/${PROPERTY_ID}`,
    allowedStatus: 200,
  },
  {
    object: 'Property__c',
    operation: 'read',
    verb: 'get',
    path: `/properties/${PROPERTY_ID}/pictures`,
    allowedStatus: 200,
  },
  {
    object: 'Property__c',
    operation: 'create',
    verb: 'post',
    path: '/properties',
    body: { name: 'Loft' },
    allowedStatus: 201,
  },
  {
    object: 'Property__c',
    operation: 'edit',
    verb: 'patch',
    path: `/properties/${PROPERTY_ID}`,
    body: { city: 'Boston' },
    allowedStatus: 200,
  },
  {
    object: 'Property__c',
    operation: 'delete',
    verb: 'delete',
    path: `/properties/${PROPERTY_ID}`,
    allowedStatus: 204,
  },
  { object: 'Broker__c', operation: 'read', verb: 'get', path: '/brokers', allowedStatus: 200 },
  {
    object: 'Broker__c',
    operation: 'read',
    verb: 'get',
    path: `/brokers/${BROKER_ID}`,
    allowedStatus: 200,
  },
  {
    object: 'Broker__c',
    operation: 'create',
    verb: 'post',
    path: '/brokers',
    body: { name: 'New Broker' },
    allowedStatus: 201,
  },
  {
    object: 'Broker__c',
    operation: 'edit',
    verb: 'patch',
    path: `/brokers/${BROKER_ID}`,
    body: { title: 'Agent' },
    allowedStatus: 200,
  },
  {
    object: 'Broker__c',
    operation: 'delete',
    verb: 'delete',
    path: `/brokers/${BROKER_ID}`,
    allowedStatus: 204,
  },
  { object: 'Contact', operation: 'read', verb: 'get', path: '/contacts', allowedStatus: 200 },
  {
    object: 'Contact',
    operation: 'read',
    verb: 'get',
    path: `/contacts/${CONTACT_ID}`,
    allowedStatus: 200,
  },
  {
    object: 'FileUtilities',
    operation: 'invoke',
    verb: 'post',
    path: '/files',
    body: { base64Data: 'aGk=', filename: 'a.png', recordId: PROPERTY_ID },
    allowedStatus: 501,
  },
  {
    object: 'SampleDataController',
    operation: 'invoke',
    verb: 'post',
    path: '/sample-data/import',
    allowedStatus: 501,
  },
  {
    object: 'GeocodingService',
    operation: 'invoke',
    verb: 'post',
    path: '/geocoding/addresses',
    body: { addresses: [] },
    allowedStatus: 200,
  },
];

const permissionSet = readPermissionSet('dreamhouse');

/**
 * Expected outcome for a user, derived from the Salesforce metadata (not from policy.ts):
 * object rows from <objectPermissions>, class rows from <classAccesses>, plus the two
 * documented decisions (Contact reads = profile baseline; SampleDataController = admin only).
 */
function salesforceAllows(user: TestUser, route: RouteUnderTest): boolean {
  if (user.groups.includes('dreamhouse-admin')) return true; // System Administrator
  if (!user.groups.includes('dreamhouse')) return false; // no permission set → nothing
  const objectXml = permissionSet.objects.find((o) => o.object === route.object);
  if (objectXml) {
    const flag = {
      create: 'allowCreate',
      read: 'allowRead',
      edit: 'allowEdit',
      delete: 'allowDelete',
    }[route.operation] as keyof typeof objectXml;
    return objectXml[flag] as boolean;
  }
  switch (route.object) {
    case 'Contact':
      return route.operation === 'read';
    case 'GeocodingService':
      return true; // flow action, no class access needed
    case 'SampleDataController':
      return false; // deviation: admin only (policy.ts DEVIATIONS)
    default:
      return permissionSet.classes.some((c) => c.apexClass === route.object && c.enabled);
  }
}

const USERS: { label: string; user: TestUser }[] = [
  { label: 'no group (guest)', user: guestUser },
  { label: 'unrelated group only', user: otherGroupUser },
  { label: 'dreamhouse (Standard User + permission set)', user: standardUser },
  { label: 'dreamhouse-admin (System Administrator)', user: adminUser },
];

/**
 * Permission matrix: group × object × operation, hidden/read-only fields, and the 401/403
 * contract. Prisma is stubbed; the same users drive tests/parity against the database.
 */
describe('permission matrix (dreamhouse permission set → Cognito groups + guards)', () => {
  let app: INestApplication;
  const prisma = {
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[]),
    ),
    property: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    broker: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    contact: { findMany: vi.fn(), findUnique: vi.fn() },
    file: { findMany: vi.fn() },
    onModuleDestroy: vi.fn(),
  };
  const geocoding = { geocodeAddress: vi.fn(), geocodeAddresses: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(GeocodingService)
      .useValue(geocoding)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    for (const model of Object.values(prisma)) {
      if (typeof model === 'object') {
        for (const fn of Object.values(model)) (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
    prisma.property.count.mockResolvedValue(1);
    prisma.property.findMany.mockResolvedValue([propertyRow()]);
    prisma.property.findUnique.mockResolvedValue(propertyRow());
    prisma.property.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      propertyRow(data),
    );
    prisma.property.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      propertyRow(data),
    );
    prisma.property.delete.mockResolvedValue(propertyRow());
    prisma.broker.findMany.mockResolvedValue([brokerRow()]);
    prisma.broker.findUnique.mockResolvedValue(brokerRow());
    prisma.broker.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      brokerRow(data),
    );
    prisma.broker.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      brokerRow(data),
    );
    prisma.broker.delete.mockResolvedValue(brokerRow());
    prisma.contact.findMany.mockResolvedValue([contactRow()]);
    prisma.contact.findUnique.mockResolvedValue(contactRow());
    prisma.file.findMany.mockResolvedValue([]);
    geocoding.geocodeAddresses.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (user: TestUser | null, route: RouteUnderTest) => {
    let req = request(app.getHttpServer())[route.verb](route.path);
    if (user) req = req.set(asUser(user));
    return route.body ? req.send(route.body) : req;
  };

  describe('group × object × operation', () => {
    for (const { label, user } of USERS) {
      for (const route of ROUTES) {
        const allowed = salesforceAllows(user, route);
        it(`${label}: ${route.verb.toUpperCase()} ${route.path} (${route.object}.${route.operation}) → ${
          allowed ? route.allowedStatus : 403
        }`, async () => {
          const res = await call(user, route);
          if (allowed) {
            expect(res.status).toBe(route.allowedStatus);
          } else {
            expect(res.status).toBe(403);
            expect(res.body).toMatchObject({
              statusCode: 403,
              error: 'Forbidden',
              output: { errors: [{ errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY' }] },
            });
            expect(typeof res.body.permission).toBe('string');
            expect(Array.isArray(res.body.requiredGroups)).toBe(true);
            // nothing was written or read on behalf of a denied caller
            expect(prisma.property.create).not.toHaveBeenCalled();
            expect(prisma.property.update).not.toHaveBeenCalled();
            expect(prisma.property.delete).not.toHaveBeenCalled();
            expect(prisma.broker.create).not.toHaveBeenCalled();
            expect(prisma.broker.delete).not.toHaveBeenCalled();
          }
        });
      }
    }

    it('the matrix covers every object/class of the permission set and both custom objects fully', () => {
      const covered = new Set(ROUTES.map((r) => `${r.object}.${r.operation}`));
      for (const o of permissionSet.objects) {
        for (const op of ['create', 'read', 'edit', 'delete'])
          expect(covered).toContain(`${o.object}.${op}`);
      }
      for (const c of permissionSet.classes) {
        const viaRoute = c.apexClass === 'PagedResult' || c.apexClass === 'PropertyController';
        expect(viaRoute || covered.has(`${c.apexClass}.invoke`), c.apexClass).toBe(true);
      }
    });
  });

  describe('401 before 403: no session, no decision', () => {
    it('answers 401 INVALID_SESSION_ID without a bearer token', async () => {
      const res = await request(app.getHttpServer()).get('/properties').expect(401);
      expect(res.body).toMatchObject({
        statusCode: 401,
        output: { errors: [{ errorCode: 'INVALID_SESSION_ID' }] },
      });
    });

    it.each([
      ['a non-bearer header', 'Basic abc'],
      ['garbage', 'Bearer not.a.jwt'],
      [
        'a token signed with another secret',
        `Bearer ${mintAccessToken(adminUser, { secret: 'wrong' })}`,
      ],
      ['an expired token', `Bearer ${mintAccessToken(adminUser, { expiresInSeconds: -60 })}`],
      [
        'another issuer',
        `Bearer ${mintAccessToken(adminUser, { issuer: 'https://evil.example' })}`,
      ],
      ['a stub token (AUTH_MODE=test does not accept them)', 'Bearer stub-token-for-admin'],
    ])('rejects %s with 401 even for an admin', async (_label, authorization) => {
      await request(app.getHttpServer())
        .get('/properties')
        .set('authorization', authorization)
        .expect(401);
      await request(app.getHttpServer())
        .post('/sample-data/import')
        .set('authorization', authorization)
        .expect(401);
    });

    it('health probes are public; everything else is not', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer()).get('/contacts').expect(401);
    });
  });

  describe('field-level security (hidden / read-only fields)', () => {
    it('GET /properties/{id}: every FLS-controlled key in the response is readable by the dreamhouse group', async () => {
      const res = await request(app.getHttpServer())
        .get(`/properties/${PROPERTY_ID}`)
        .set(asUser(standardUser))
        .expect(200);
      const access = fieldAccess(standardUser.groups, 'Property__c');
      for (const key of Object.keys(res.body)) {
        if (access.controlled.has(key)) expect(access.readable.has(key), key).toBe(true);
      }
      expect(res.body).toMatchObject({
        name: 'Stunning Victorian',
        price: 975000,
        city: 'Cambridge',
      });
    });

    it('GET /properties list items are filtered the same way (PagedResult.records)', async () => {
      const res = await request(app.getHttpServer())
        .get('/properties')
        .set(asUser(standardUser))
        .expect(200);
      expect(res.body.records).toHaveLength(1);
      expect(res.body.records[0]).toMatchObject({ id: PROPERTY_ID, price: 975000 });
    });

    it.each([
      [
        'Property__c.Days_On_Market__c',
        'patch',
        `/properties/${PROPERTY_ID}`,
        { daysOnMarket: 12 },
        'daysOnMarket',
      ],
      [
        'Property__c.Record_Link__c',
        'post',
        '/properties',
        { name: 'Loft', recordLink: 'x' },
        'recordLink',
      ],
      [
        'Property__c.Picture_IMG__c',
        'patch',
        `/properties/${PROPERTY_ID}`,
        { pictureImg: 'x' },
        'pictureImg',
      ],
      [
        'Property__c.Thumbnail_IMG__c',
        'patch',
        `/properties/${PROPERTY_ID}`,
        { thumbnailImg: 'x' },
        'thumbnailImg',
      ],
      [
        'Broker__c.Picture_IMG__c',
        'patch',
        `/brokers/${BROKER_ID}`,
        { pictureImg: 'x' },
        'pictureImg',
      ],
    ] as const)(
      'writing the read-only formula field %s is 403 INVALID_FIELD_FOR_INSERT_UPDATE for dreamhouse and admin alike',
      async (_sfField, verb, path, body, field) => {
        for (const user of [standardUser, adminUser]) {
          const res = await request(app.getHttpServer())
            [verb](path)
            .set(asUser(user))
            .send(body)
            .expect(403);
          expect(res.body.output.fieldErrors[field][0]).toMatchObject({
            errorCode: 'INVALID_FIELD_FOR_INSERT_UPDATE',
          });
          expect(res.body.output.errors[0].errorCode).toBe('INSUFFICIENT_ACCESS_OR_READONLY');
        }
        expect(prisma.property.update).not.toHaveBeenCalled();
        expect(prisma.property.create).not.toHaveBeenCalled();
        expect(prisma.broker.update).not.toHaveBeenCalled();
      },
    );

    it('editable fields of the permission set go through (control: the same PATCH without the formula field)', async () => {
      await request(app.getHttpServer())
        .patch(`/properties/${PROPERTY_ID}`)
        .set(asUser(standardUser))
        .send({ city: 'Boston', price: 1 })
        .expect(200);
      expect(prisma.property.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('row-level sharing (org-wide defaults + View All / Modify All)', () => {
    it('Property__c / Broker__c (Public Read/Write + viewAll/modifyAll): no owner filter for dreamhouse', async () => {
      await request(app.getHttpServer()).get('/properties').set(asUser(standardUser)).expect(200);
      expect(prisma.property.findMany.mock.calls[0][0].where).not.toHaveProperty('ownerId');
      await request(app.getHttpServer()).get('/brokers').set(asUser(standardUser)).expect(200);
      expect(prisma.broker.findMany.mock.calls[0][0].where).toEqual({});
      prisma.property.findUnique.mockResolvedValue(propertyRow({ ownerId: 'someone-else' }));
      await request(app.getHttpServer())
        .delete(`/properties/${PROPERTY_ID}`)
        .set(asUser(standardUser))
        .expect(204);
    });

    it('Contact (Controlled by Parent, no Account): dreamhouse sees its own rows, admin (View All) every row', async () => {
      await request(app.getHttpServer()).get('/contacts').set(asUser(standardUser)).expect(200);
      expect(prisma.contact.findMany.mock.calls[0][0].where).toEqual({
        ownerId: 'test-standarduser',
      });
      await request(app.getHttpServer()).get('/contacts').set(asUser(adminUser)).expect(200);
      expect(prisma.contact.findMany.mock.calls[1][0].where).toEqual({});

      prisma.contact.findUnique.mockResolvedValue(contactRow({ ownerId: 'someone-else' }));
      await request(app.getHttpServer())
        .get(`/contacts/${CONTACT_ID}`)
        .set(asUser(standardUser))
        .expect(404);
      await request(app.getHttpServer())
        .get(`/contacts/${CONTACT_ID}`)
        .set(asUser(adminUser))
        .expect(200);
    });

    it('created records are owned by the caller (OwnerId / CreatedById)', async () => {
      await request(app.getHttpServer())
        .post('/brokers')
        .set(asUser(standardUser))
        .send({ name: 'B' })
        .expect(201);
      expect(prisma.broker.create.mock.calls[0][0].data).toMatchObject({
        ownerId: 'test-standarduser',
        createdBy: 'test-standarduser',
      });
    });
  });
});
