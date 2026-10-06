import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { asUser, standardUser } from './support/test-users';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import './setup-env';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { Prisma } from '../src/generated/prisma/client';
import { GeocodingService } from '../src/modules/geocoding/geocoding.service';
import { PrismaService } from '../src/prisma/prisma.service';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const BROKER_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-06T08:00:00.000Z');

function propertyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPERTY_ID,
    sfId: null,
    name: 'Stunning Victorian',
    address: '18 Henry St',
    city: 'Cambridge',
    state: 'MA',
    zip: '01742',
    description: null,
    tags: 'victorian',
    price: new Prisma.Decimal('975000.00'),
    priceSold: null,
    assessedValue: null,
    beds: 4,
    baths: 3,
    status: 'Available',
    dateListed: new Date('2026-10-06T00:00:00.000Z'),
    datePreMarket: null,
    dateContracted: null,
    dateAgreement: null,
    dateClosed: null,
    locationLatitude: new Prisma.Decimal('42.3566300'),
    locationLongitude: new Prisma.Decimal('-71.1109500'),
    picture: null,
    thumbnail: null,
    brokerId: BROKER_ID,
    ownerId: null,
    createdById: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function brokerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BROKER_ID,
    sfId: null,
    name: 'Caroline Kingsley',
    brokerId: new Prisma.Decimal('1'),
    title: 'Senior Broker',
    phone: '617-244-3672',
    mobilePhone: null,
    email: 'caroline@dreamhouse.demo',
    picture: null,
    ownerId: null,
    createdById: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** The error Prisma 7 + @prisma/adapter-pg raise for the given Postgres failure (see migration CHECKs). */
function prismaError(code: string, meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

function checkViolation(constraint: string, model = 'Property') {
  return prismaError('P2039', {
    modelName: model,
    driverAdapterError: {
      cause: {
        code: '23514',
        originalMessage: `new row for relation "properties" violates check constraint "${constraint}"`,
      },
    },
  });
}

/**
 * HTTP contract of the record CRUD and its field-error body (Prisma stubbed; the database
 * round-trip is covered by tests/parity/characterisation/create-property-flow.spec.ts).
 */
describe('record CRUD (http)', () => {
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
  const geocoding = { geocodeAddress: vi.fn() };

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
    geocoding.geocodeAddress.mockReset().mockResolvedValue({ lat: 42.35663, lon: -71.11095 });
    prisma.property.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      propertyRow({ ...data, status: data.status ?? null }),
    );
    prisma.property.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      propertyRow(data),
    );
    prisma.property.findUnique.mockResolvedValue(propertyRow());
    prisma.broker.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      brokerRow(data),
    );
    prisma.broker.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      brokerRow(data),
    );
    prisma.broker.findUnique.mockResolvedValue(brokerRow());
    prisma.broker.findMany.mockResolvedValue([brokerRow()]);
    prisma.contact.findMany.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  // Requests run as the Standard User + `dreamhouse` permission set (TestPropertyController runAs).
  const http = () => request.agent(app.getHttpServer()).set(asUser(standardUser));

  describe('field-error contract (output.fieldErrors, Lightning UI API shape)', () => {
    it('answers 400 with one entry per failed rule, keyed by API field, with Salesforce StatusCode names', async () => {
      const res = await http()
        .post('/properties')
        .send({
          name: '',
          beds: 100,
          baths: -1,
          status: 'Sold',
          price: 'expensive',
          dateListed: '2026-02-30',
          brokerId: 'not-a-uuid',
          picture: 'not a url',
          bogus: 1,
        })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(res.body.message).toMatch(/^Validation failed: /);
      expect(res.body.output.errors).toEqual([]);
      const { fieldErrors } = res.body.output;
      expect(Object.keys(fieldErrors).sort()).toEqual(
        [
          'baths',
          'beds',
          'bogus',
          'brokerId',
          'dateListed',
          'name',
          'picture',
          'price',
          'status',
        ].sort(),
      );
      expect(fieldErrors.name).toEqual([
        { field: 'name', errorCode: 'REQUIRED_FIELD_MISSING', message: 'name should not be empty' },
      ]);
      expect(fieldErrors.beds).toEqual([
        {
          field: 'beds',
          errorCode: 'FIELD_INTEGRITY_EXCEPTION',
          message: 'beds must not be greater than 99',
        },
      ]);
      expect(fieldErrors.baths[0]).toMatchObject({ errorCode: 'FIELD_INTEGRITY_EXCEPTION' });
      expect(fieldErrors.status[0]).toMatchObject({
        errorCode: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST',
      });
      expect(fieldErrors.price.map((e: { errorCode: string }) => e.errorCode)).toContain(
        'INVALID_TYPE_ON_FIELD_IN_RECORD',
      );
      expect(fieldErrors.dateListed[0]).toMatchObject({
        errorCode: 'INVALID_TYPE_ON_FIELD_IN_RECORD',
        message: 'dateListed must be a calendar date (YYYY-MM-DD)',
      });
      expect(fieldErrors.brokerId[0]).toMatchObject({ errorCode: 'INVALID_ID_FIELD' });
      expect(fieldErrors.picture[0]).toMatchObject({ errorCode: 'FIELD_INTEGRITY_EXCEPTION' });
      expect(fieldErrors.bogus[0]).toMatchObject({ errorCode: 'INVALID_FIELD' });
      expect(prisma.property.create).not.toHaveBeenCalled();
    });

    it('enforces the field lengths of the schema step (STRING_TOO_LONG)', async () => {
      const res = await http()
        .post('/properties')
        .send({ name: 'x'.repeat(81), city: 'y'.repeat(51), zip: '0123456789A' })
        .expect(400);
      for (const field of ['name', 'city', 'zip']) {
        expect(res.body.output.fieldErrors[field][0]).toMatchObject({
          errorCode: 'STRING_TOO_LONG',
        });
      }
    });

    it('requires latitude and longitude together (Location__c compound field)', async () => {
      const res = await http()
        .post('/properties')
        .send({ name: 'Loft', latitude: 42.1 })
        .expect(400);
      expect(res.body.output.fieldErrors).toEqual({
        longitude: [
          {
            field: 'longitude',
            errorCode: 'FIELD_INTEGRITY_EXCEPTION',
            message: 'latitude and longitude must be set together',
          },
        ],
      });
      expect(prisma.property.create).not.toHaveBeenCalled();
    });

    it('translates a CHECK constraint violation into the same field-error body', async () => {
      prisma.property.create.mockRejectedValue(checkViolation('properties_beds_check'));
      const res = await http().post('/properties').send({ name: 'Loft', beds: 5 }).expect(400);
      expect(res.body.output.fieldErrors).toEqual({
        beds: [
          {
            field: 'beds',
            errorCode: 'FIELD_INTEGRITY_EXCEPTION',
            message: 'beds is out of range',
          },
        ],
      });
    });

    it('translates the location CHECK onto both halves of the compound field', async () => {
      prisma.property.create.mockRejectedValue(checkViolation('properties_location_check'));
      const res = await http().post('/properties').send({ name: 'Loft' }).expect(400);
      expect(Object.keys(res.body.output.fieldErrors).sort()).toEqual(['latitude', 'longitude']);
    });

    it('rejects a Broker__c lookup to a missing record before inserting (INVALID_CROSS_REFERENCE_KEY)', async () => {
      prisma.broker.findUnique.mockResolvedValue(null);
      const res = await http()
        .post('/properties')
        .send({ name: 'Loft', brokerId: BROKER_ID })
        .expect(400);
      expect(res.body.output.fieldErrors.brokerId[0]).toMatchObject({
        errorCode: 'INVALID_CROSS_REFERENCE_KEY',
      });
      expect(prisma.broker.findUnique).toHaveBeenCalledWith({
        where: { id: BROKER_ID },
        select: { id: true },
      });
      expect(prisma.property.create).not.toHaveBeenCalled();
    });

    it('translates a broken Broker__c lookup (FK, e.g. a concurrent delete) into the same field error', async () => {
      prisma.property.create.mockRejectedValue(
        prismaError('P2003', {
          modelName: 'Property',
          driverAdapterError: { cause: { constraint: { index: 'properties_broker_id_fkey' } } },
        }),
      );
      const res = await http()
        .post('/properties')
        .send({ name: 'Loft', brokerId: BROKER_ID })
        .expect(400);
      expect(res.body.output.fieldErrors).toEqual({
        brokerId: [
          {
            field: 'brokerId',
            errorCode: 'INVALID_CROSS_REFERENCE_KEY',
            message: 'brokerId refers to a record that does not exist',
          },
        ],
      });
    });

    it('keeps the Nest error contract for malformed route ids and unknown records', async () => {
      await http().get('/properties/not-a-uuid').expect(400);
      prisma.property.findUnique.mockResolvedValue(null);
      const res = await http().get(`/properties/${PROPERTY_ID}`).expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, message: 'Property not found' });
      prisma.property.delete.mockRejectedValue(
        prismaError('P2025', { modelName: 'Property', operation: 'a delete' }),
      );
      await http().delete(`/properties/${PROPERTY_ID}`).expect(404);
    });
  });

  describe('POST /properties (Create_property flow)', () => {
    const flowInputs = {
      name: 'Stunning Victorian',
      description: 'Lorem ipsum dolor sit amet',
      brokerId: BROKER_ID,
      price: 975000,
      address: '18 Henry St',
      city: 'Cambridge',
      state: 'MA',
      zip: '01742',
      country: 'USA',
      beds: 4,
      baths: 3,
      tags: 'victorian',
    };

    it('applies the create_property assignments: Status__c Available, Date_Listed__c today; no geocoding by default', async () => {
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
      try {
        const res = await http().post('/properties').send(flowInputs).expect(201);
        expect(prisma.property.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Stunning Victorian',
            address: '18 Henry St',
            city: 'Cambridge',
            state: 'MA',
            zip: '01742',
            brokerId: BROKER_ID,
            tags: 'victorian',
            beds: 4,
            baths: 3,
            status: 'Available',
            dateListed: new Date('2026-10-06T00:00:00.000Z'),
          }),
        });
        const data = prisma.property.create.mock.calls[0][0].data;
        expect(data.price).toBeInstanceOf(Prisma.Decimal);
        expect(data.price.toString()).toBe('975000');
        expect(data).not.toHaveProperty('country');
        expect(data).not.toHaveProperty('geocode');
        expect(geocoding.geocodeAddress).not.toHaveBeenCalled();
        expect(res.body).toMatchObject({
          id: PROPERTY_ID,
          status: 'Available',
          dateListed: '2026-10-06',
          price: 975000,
          createdAt: NOW.toISOString(),
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('geocode: true runs the geocode_address action with the flow address mapping and stores lat/lon', async () => {
      const res = await http()
        .post('/properties')
        .send({ ...flowInputs, geocode: true })
        .expect(201);
      expect(geocoding.geocodeAddress).toHaveBeenCalledWith(
        {
          street: '18 Henry St',
          city: 'Cambridge',
          state: 'MA',
          country: 'USA',
          postalcode: '01742',
        },
        { onError: 'throw' },
      );
      const data = prisma.property.create.mock.calls[0][0].data;
      expect(data.locationLatitude.toNumber()).toBe(42.35663);
      expect(data.locationLongitude.toNumber()).toBe(-71.11095);
      expect(res.body).toMatchObject({ latitude: 42.35663, longitude: -71.11095 });
    });

    it('geocode: true with no match stores an empty Location__c (Apex Coordinates with null lat/lon)', async () => {
      geocoding.geocodeAddress.mockResolvedValue({ lat: null, lon: null });
      await http()
        .post('/properties')
        .send({ ...flowInputs, geocode: true })
        .expect(201);
      const data = prisma.property.create.mock.calls[0][0].data;
      expect(data.locationLatitude).toBeNull();
      expect(data.locationLongitude).toBeNull();
    });

    it('a geocoder failure is the flow fault path: 502 GEOCODING_FAULT and nothing is created', async () => {
      geocoding.geocodeAddress.mockRejectedValue(new Error('Nominatim answered 503'));
      const res = await http()
        .post('/properties')
        .send({ ...flowInputs, geocode: true })
        .expect(502);
      expect(res.body).toEqual({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Geocoding failed: Nominatim answered 503',
        output: {
          errors: [
            { errorCode: 'GEOCODING_FAULT', message: 'Geocoding failed: Nominatim answered 503' },
          ],
          fieldErrors: {},
        },
      });
      expect(prisma.property.create).not.toHaveBeenCalled();
    });

    it('explicit status/dateListed win over the flow defaults', async () => {
      await http()
        .post('/properties')
        .send({ name: 'Loft', status: 'Pre Market', dateListed: '2026-01-15' })
        .expect(201);
      expect(prisma.property.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'PreMarket',
          dateListed: new Date('2026-01-15T00:00:00.000Z'),
        }),
      });
    });
  });

  describe('GET / PATCH / DELETE /properties/{id}', () => {
    it('GET answers the full record with picklist labels, calendar dates and numbers', async () => {
      const res = await http().get(`/properties/${PROPERTY_ID}`).expect(200);
      expect(res.headers['cache-control']).toBe('private, max-age=30, stale-while-revalidate=60');
      expect(res.body).toEqual({
        id: PROPERTY_ID,
        sfId: null,
        name: 'Stunning Victorian',
        address: '18 Henry St',
        city: 'Cambridge',
        state: 'MA',
        zip: '01742',
        description: null,
        tags: 'victorian',
        price: 975000,
        priceSold: null,
        assessedValue: null,
        beds: 4,
        baths: 3,
        status: 'Available',
        dateListed: '2026-10-06',
        datePreMarket: null,
        dateContracted: null,
        dateAgreement: null,
        dateClosed: null,
        latitude: 42.35663,
        longitude: -71.11095,
        picture: null,
        thumbnail: null,
        brokerId: BROKER_ID,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
    });

    it('PATCH updates only the sent fields, null clears, and name cannot be cleared', async () => {
      await http()
        .patch(`/properties/${PROPERTY_ID}`)
        .send({ price: 950000, status: 'Under Agreement', description: null })
        .expect(200);
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: PROPERTY_ID },
        data: { price: new Prisma.Decimal(950000), status: 'UnderAgreement', description: null },
      });

      const res = await http().patch(`/properties/${PROPERTY_ID}`).send({ name: null }).expect(400);
      expect(
        res.body.output.fieldErrors.name.map((e: { errorCode: string }) => e.errorCode),
      ).toContain('REQUIRED_FIELD_MISSING');
    });

    it('PATCH pairs the new latitude/longitude with the stored half', async () => {
      prisma.property.findUnique.mockResolvedValue(
        propertyRow({ locationLatitude: null, locationLongitude: null }),
      );
      const res = await http()
        .patch(`/properties/${PROPERTY_ID}`)
        .send({ longitude: -71.1 })
        .expect(400);
      expect(Object.keys(res.body.output.fieldErrors)).toEqual(['latitude']);
      await http()
        .patch(`/properties/${PROPERTY_ID}`)
        .send({ latitude: 42.1, longitude: -71.1 })
        .expect(200);
    });

    it('PATCH geocode: true re-geocodes the merged address', async () => {
      await http()
        .patch(`/properties/${PROPERTY_ID}`)
        .send({ address: '1 Main St', geocode: true, country: 'USA' })
        .expect(200);
      expect(geocoding.geocodeAddress).toHaveBeenCalledWith(
        {
          street: '1 Main St',
          city: 'Cambridge',
          state: 'MA',
          country: 'USA',
          postalcode: '01742',
        },
        { onError: 'throw' },
      );
      const data = prisma.property.update.mock.calls[0][0].data;
      expect(data.locationLatitude.toNumber()).toBe(42.35663);
    });

    it('DELETE answers 204 and removes the record in a transaction', async () => {
      prisma.property.delete.mockResolvedValue(propertyRow());
      await http().delete(`/properties/${PROPERTY_ID}`).expect(204);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.property.delete).toHaveBeenCalledWith({ where: { id: PROPERTY_ID } });
    });
  });

  describe('brokers CRUD', () => {
    it('GET /brokers and GET /brokers/{id} answer the full Broker__c record', async () => {
      const list = await http().get('/brokers').expect(200);
      expect(list.body).toHaveLength(1);
      const res = await http().get(`/brokers/${BROKER_ID}`).expect(200);
      expect(res.body).toEqual({
        id: BROKER_ID,
        sfId: null,
        name: 'Caroline Kingsley',
        brokerId: '1',
        title: 'Senior Broker',
        email: 'caroline@dreamhouse.demo',
        phone: '617-244-3672',
        mobilePhone: null,
        picture: null,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
      prisma.broker.findUnique.mockResolvedValue(null);
      await http().get(`/brokers/${BROKER_ID}`).expect(404);
    });

    it('POST /brokers validates like the Broker__c record form', async () => {
      const res = await http()
        .post('/brokers')
        .send({ name: '', email: 'nope', title: 't'.repeat(31), brokerId: '12.5' })
        .expect(400);
      const { fieldErrors } = res.body.output;
      expect(fieldErrors.name[0]).toMatchObject({ errorCode: 'REQUIRED_FIELD_MISSING' });
      expect(fieldErrors.email[0]).toMatchObject({ errorCode: 'INVALID_EMAIL_ADDRESS' });
      expect(fieldErrors.title[0]).toMatchObject({ errorCode: 'STRING_TOO_LONG' });
      expect(fieldErrors.brokerId[0]).toMatchObject({ errorCode: 'FIELD_INTEGRITY_EXCEPTION' });

      const created = await http()
        .post('/brokers')
        .send({ name: 'Caroline Kingsley', brokerId: '1', email: 'caroline@dreamhouse.demo' })
        .expect(201);
      expect(prisma.broker.create).toHaveBeenCalledWith({
        data: {
          ownerId: 'test-standarduser',
          createdBy: 'test-standarduser',
          name: 'Caroline Kingsley',
          brokerId: new Prisma.Decimal('1'),
          email: 'caroline@dreamhouse.demo',
        },
      });
      expect(created.body).toMatchObject({ id: BROKER_ID, brokerId: '1' });
    });

    it('PATCH and DELETE /brokers/{id}', async () => {
      await http()
        .patch(`/brokers/${BROKER_ID}`)
        .send({ title: null, phone: '617-000-0000' })
        .expect(200);
      expect(prisma.broker.update).toHaveBeenCalledWith({
        where: { id: BROKER_ID },
        data: { title: null, phone: '617-000-0000' },
      });
      prisma.broker.delete.mockResolvedValue(brokerRow());
      await http().delete(`/brokers/${BROKER_ID}`).expect(204);
      prisma.broker.delete.mockRejectedValue(
        prismaError('P2025', { modelName: 'Broker', operation: 'a delete' }),
      );
      const res = await http().delete(`/brokers/${BROKER_ID}`).expect(404);
      expect(res.body.message).toBe('Broker not found');
    });
  });
});
