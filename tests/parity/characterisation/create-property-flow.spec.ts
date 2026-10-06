/**
 * Baseline of salesforce/force-app/main/default/flows/Create_property.flow-meta.xml
 * against POST /properties (the flow has no Apex test class; the fixture
 * tests/parity/fixtures/create-property-flow.ts is the record the flow creates).
 *
 * Flow element → API: screens → request body; `geocode_address` → `geocode: true`
 * (Nominatim mocked like GeocodingServiceTest does); `create_property` → the insert;
 * fault connectors → 4xx/502 with nothing inserted. Goes green with plan step s4.5 / UNT3-19.
 */
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect } from 'vitest';
import { useApiTestContext } from './harness/api-test-context';
import { characterise } from './harness/characterise';
import { createBroker } from '../fixtures/brokers';
import {
  createPropertyFlowBaseline,
  flowCurrentDate,
  flowRequestBody,
} from '../fixtures/create-property-flow';
import { standardUser, asUser } from '../fixtures/users';
import {
  createGeocodingMockServer,
  NOMINATIM_SEARCH_URL,
  nominatimError,
  nominatimSuccess,
  unhandledRequestPolicy,
} from '../mocks/nominatim';

const { spec } = characterise('Create_property (flow)', 'UNT3-19');
const ctx = useApiTestContext();
const nominatim = createGeocodingMockServer();
const baseline = createPropertyFlowBaseline;

beforeAll(() => nominatim.listen(unhandledRequestPolicy));
afterEach(() => nominatim.resetHandlers());
afterAll(() => nominatim.close());

async function runFlow(body: object) {
  // Screens new_property → address → property_details, then Finish: one POST /properties.
  return ctx.api().post('/properties').set(asUser(standardUser)).send(body);
}

describe('Create_property flow', () => {
  spec('creates the record the flow creates for the same inputs (baseline fixture)', async () => {
    // GIVEN — property_broker.recordId: an existing Broker__c; geocode_address answers the baseline.
    const broker = await createBroker(ctx.prisma);
    const mock = nominatimSuccess(baseline.nominatim.lat, baseline.nominatim.lon);
    nominatim.use(mock.handler);

    // WHEN — the three screens' inputs are submitted.
    const response = await runFlow(flowRequestBody(broker.id));
    expect(response.status).toBe(201);

    // THEN — geocode_address got the address screen (GeocodingAddress street/city/state/country/postalcode).
    expect(mock.calls).toHaveLength(1);
    const params = mock.calls[0].searchParams;
    expect(params.get('street')).toBe(baseline.address.street);
    expect(params.get('city')).toBe(baseline.address.city);
    expect(params.get('state')).toBe(baseline.address.province);
    expect(params.get('country')).toBe(baseline.address.country);
    expect(params.get('postalcode')).toBe(baseline.address.postalCode);

    // create_property inputAssignments, field by field.
    expect(response.body).toMatchObject({
      ...baseline.expectedRecord,
      brokerId: broker.id, // Broker__c ← property_broker.recordId
      dateListed: flowCurrentDate(), // Date_Listed__c ← $Flow.CurrentDate
    });
    for (const field of baseline.untouchedFields) {
      expect(response.body[field]).toBeNull();
    }

    // The row the flow would leave in the org, read back through the record page (LDS getRecord).
    const stored = await ctx.api().get(`/properties/${response.body.id}`).set(asUser(standardUser));
    expect(stored.status).toBe(200);
    expect(stored.body).toEqual(response.body);
    const row = await ctx.prisma.db.property.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(row.status).toBe('Available');
    expect(row.locationLatitude?.toNumber()).toBe(baseline.nominatim.lat);
    expect(row.locationLongitude?.toNumber()).toBe(baseline.nominatim.lon);
  });

  spec(
    'geocode_address with a non-200 answer leaves Location__c empty (GeocodingService.cls line 41)',
    async () => {
      const broker = await createBroker(ctx.prisma);
      nominatim.use(nominatimError().handler);

      const response = await runFlow(flowRequestBody(broker.id));

      // Apex returned an empty Coordinates; the flow still ran create_property.
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ latitude: null, longitude: null, status: 'Available' });
    },
  );

  spec(
    'geocode_address fault connector: callout failure → Error5 screen, nothing created',
    async () => {
      const broker = await createBroker(ctx.prisma);
      nominatim.use(http.get(NOMINATIM_SEARCH_URL, () => HttpResponse.error()));
      const before = await ctx.prisma.db.property.count();

      const response = await runFlow(flowRequestBody(broker.id));

      expect(response.status).toBe(502);
      expect(response.body.output.errors[0]).toMatchObject({ errorCode: 'GEOCODING_FAULT' });
      expect(await ctx.prisma.db.property.count()).toBe(before);
    },
  );

  spec(
    'create_property fault connector: the record-level rules answer field errors, nothing created',
    async () => {
      // property_name is a required screen input; Broker__c must point at an existing record.
      const before = await ctx.prisma.db.property.count();
      const missingName = await runFlow({
        ...flowRequestBody('11111111-1111-4111-8111-111111111111', false),
        name: '',
      });
      expect(missingName.status).toBe(400);
      expect(missingName.body.output.fieldErrors.name[0]).toMatchObject({
        errorCode: 'REQUIRED_FIELD_MISSING',
      });

      const brokenLookup = await runFlow(
        flowRequestBody('11111111-1111-4111-8111-111111111111', false),
      );
      expect(brokenLookup.status).toBe(400);
      expect(brokenLookup.body.output.fieldErrors.brokerId[0]).toMatchObject({
        errorCode: 'INVALID_CROSS_REFERENCE_KEY',
      });

      // Schema-step rule living only in the database (CHECK properties_beds_check is 0..99; the DTO mirrors it).
      const tooManyBeds = await runFlow({
        ...flowRequestBody('11111111-1111-4111-8111-111111111111', false),
        brokerId: null,
        beds: 100,
      });
      expect(tooManyBeds.status).toBe(400);
      expect(tooManyBeds.body.output.fieldErrors.beds[0]).toMatchObject({
        errorCode: 'FIELD_INTEGRITY_EXCEPTION',
      });
      expect(await ctx.prisma.db.property.count()).toBe(before);
    },
  );

  spec(
    'record page actions after the flow: edit, then delete (LDS updateRecord / deleteRecord)',
    async () => {
      const broker = await createBroker(ctx.prisma);
      nominatim.use(nominatimSuccess(baseline.nominatim.lat, baseline.nominatim.lon).handler);
      const created = await runFlow(flowRequestBody(broker.id));
      expect(created.status).toBe(201);

      const edited = await ctx
        .api()
        .patch(`/properties/${created.body.id}`)
        .set(asUser(standardUser))
        .send({ status: 'Under Agreement', dateAgreement: flowCurrentDate(), price: 950000 });
      expect(edited.status).toBe(200);
      expect(edited.body).toMatchObject({
        status: 'Under Agreement',
        price: 950000,
        dateAgreement: flowCurrentDate(),
      });
      const row = await ctx.prisma.db.property.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      expect(row.status).toBe('UnderAgreement');

      const deleted = await ctx
        .api()
        .delete(`/properties/${created.body.id}`)
        .set(asUser(standardUser));
      expect(deleted.status).toBe(204);
      const gone = await ctx.api().get(`/properties/${created.body.id}`).set(asUser(standardUser));
      expect(gone.status).toBe(404);
    },
  );

  spec(
    'Broker__c CRUD behind the Broker record page; deleting a broker clears the lookup',
    async () => {
      const created = await ctx.api().post('/brokers').set(asUser(standardUser)).send({
        name: 'Michael Jones',
        title: 'Senior Broker',
        email: 'michael@dreamhouse.demo',
        brokerId: '2',
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ name: 'Michael Jones', brokerId: '2' });

      const property = await runFlow(flowRequestBody(created.body.id, false));
      expect(property.status).toBe(201);

      const listed = await ctx.api().get('/brokers').set(asUser(standardUser));
      expect(listed.body.map((b: { id: string }) => b.id)).toContain(created.body.id);

      const edited = await ctx
        .api()
        .patch(`/brokers/${created.body.id}`)
        .set(asUser(standardUser))
        .send({ phone: '617-244-3672', title: null });
      expect(edited.status).toBe(200);
      expect(edited.body).toMatchObject({ phone: '617-244-3672', title: null });

      const invalid = await ctx
        .api()
        .post('/brokers')
        .set(asUser(standardUser))
        .send({ name: 'x', email: 'nope' });
      expect(invalid.status).toBe(400);
      expect(invalid.body.output.fieldErrors.email[0]).toMatchObject({
        errorCode: 'INVALID_EMAIL_ADDRESS',
      });

      const removed = await ctx
        .api()
        .delete(`/brokers/${created.body.id}`)
        .set(asUser(standardUser));
      expect(removed.status).toBe(204);
      const orphan = await ctx
        .api()
        .get(`/properties/${property.body.id}`)
        .set(asUser(standardUser));
      expect(orphan.body.brokerId).toBeNull(); // lookup "Clear the value of this field" → ON DELETE SET NULL
    },
  );
});
