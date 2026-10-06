/**
 * Characterisation of the `dreamhouse` permission set and the org-wide defaults
 * (salesforce/force-app/main/default/permissionsets/dreamhouse.permissionset-meta.xml,
 * objects/*\/*.object-meta.xml `<sharingModel>`) against the API guards, live against the
 * database: what TestPropertyController's `runAs(standardUser)` block (lines 28-53) relies
 * on, plus the denials a user without the permission set hits. The exhaustive group ×
 * object × operation matrix (Prisma stubbed) is app/api/test/permissions.e2e.spec.ts.
 */
import { describe, expect } from 'vitest';
import { useApiTestContext } from './harness/api-test-context';
import { characterise } from './harness/characterise';
import { createBroker } from '../fixtures/brokers';
import { createProperty } from '../fixtures/properties';
import { adminUser, asUser, guestUser, standardUser, type TestUser } from '../fixtures/users';

const { spec } = characterise('dreamhouse.permissionset', 'UNT3-20');
const ctx = useApiTestContext();

const INSUFFICIENT_ACCESS = {
  statusCode: 403,
  output: { errors: [{ errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY' }] },
};

async function seed() {
  const broker = await createBroker(ctx.prisma);
  const property = await createProperty(ctx.prisma, { name: 'Stunning Victorian' });
  return { broker, property };
}

describe('dreamhouse permission set → Cognito groups', () => {
  spec(
    'Standard User + dreamhouse: full Property__c / Broker__c CRUD (objectPermissions)',
    async () => {
      const { broker, property } = await seed();
      const api = () => ctx.api();
      expect((await api().get('/properties').set(asUser(standardUser))).status).toBe(200);
      expect((await api().get(`/properties/${property.id}`).set(asUser(standardUser))).status).toBe(
        200,
      );
      const created = await api()
        .post('/properties')
        .set(asUser(standardUser))
        .send({ name: 'Loft', brokerId: broker.id });
      expect(created.status).toBe(201);
      expect(
        (
          await api()
            .patch(`/properties/${created.body.id}`)
            .set(asUser(standardUser))
            .send({ city: 'Boston' })
        ).status,
      ).toBe(200);
      expect(
        (await api().delete(`/properties/${created.body.id}`).set(asUser(standardUser))).status,
      ).toBe(204);
      expect((await api().get('/brokers').set(asUser(standardUser))).status).toBe(200);
      const newBroker = await api()
        .post('/brokers')
        .set(asUser(standardUser))
        .send({ name: 'New Broker' });
      expect(newBroker.status).toBe(201);
      expect(
        (
          await api()
            .patch(`/brokers/${newBroker.body.id}`)
            .set(asUser(standardUser))
            .send({ title: 'Agent' })
        ).status,
      ).toBe(200);
      expect(
        (await api().delete(`/brokers/${newBroker.body.id}`).set(asUser(standardUser))).status,
      ).toBe(204);
    },
  );

  spec(
    'a user without the permission set is denied every Dreamhouse operation with 403',
    async () => {
      const { broker, property } = await seed();
      const attempts: [string, () => Promise<{ status: number; body: unknown }>][] = [
        ['GET /properties', () => ctx.api().get('/properties').set(asUser(guestUser))],
        [
          'GET /properties/{id}',
          () => ctx.api().get(`/properties/${property.id}`).set(asUser(guestUser)),
        ],
        [
          'GET /properties/{id}/pictures',
          () => ctx.api().get(`/properties/${property.id}/pictures`).set(asUser(guestUser)),
        ],
        [
          'POST /properties',
          () => ctx.api().post('/properties').set(asUser(guestUser)).send({ name: 'Loft' }),
        ],
        [
          'PATCH /properties/{id}',
          () =>
            ctx
              .api()
              .patch(`/properties/${property.id}`)
              .set(asUser(guestUser))
              .send({ city: 'X' }),
        ],
        [
          'DELETE /properties/{id}',
          () => ctx.api().delete(`/properties/${property.id}`).set(asUser(guestUser)),
        ],
        ['GET /brokers', () => ctx.api().get('/brokers').set(asUser(guestUser))],
        ['GET /brokers/{id}', () => ctx.api().get(`/brokers/${broker.id}`).set(asUser(guestUser))],
        [
          'POST /brokers',
          () => ctx.api().post('/brokers').set(asUser(guestUser)).send({ name: 'B' }),
        ],
        [
          'PATCH /brokers/{id}',
          () =>
            ctx.api().patch(`/brokers/${broker.id}`).set(asUser(guestUser)).send({ title: 'T' }),
        ],
        [
          'DELETE /brokers/{id}',
          () => ctx.api().delete(`/brokers/${broker.id}`).set(asUser(guestUser)),
        ],
        ['GET /contacts', () => ctx.api().get('/contacts').set(asUser(guestUser))],
        [
          'POST /geocoding/addresses',
          () =>
            ctx.api().post('/geocoding/addresses').set(asUser(guestUser)).send({ addresses: [] }),
        ],
        [
          'POST /files',
          () =>
            ctx
              .api()
              .post('/files')
              .set(asUser(guestUser))
              .send({ base64Data: 'aGk=', filename: 'a.png', recordId: property.id }),
        ],
        [
          'POST /sample-data/import',
          () => ctx.api().post('/sample-data/import').set(asUser(guestUser)),
        ],
      ];
      for (const [label, attempt] of attempts) {
        const res = await attempt();
        expect(res.status, label).toBe(403);
        expect(res.body, label).toMatchObject(INSUFFICIENT_ACCESS);
      }
      // nothing changed behind the 403s
      expect(
        (await ctx.api().get(`/properties/${property.id}`).set(asUser(adminUser))).body,
      ).toMatchObject({
        name: 'Stunning Victorian',
      });
      expect((await ctx.api().get(`/brokers/${broker.id}`).set(asUser(adminUser))).status).toBe(
        200,
      );
    },
  );

  spec(
    'classAccesses: SampleDataController and FileUtilities are not callable by the standard group',
    async () => {
      const { property } = await seed();
      const files = await ctx
        .api()
        .post('/files')
        .set(asUser(standardUser))
        .send({ base64Data: 'aGk=', filename: 'a.png', recordId: property.id });
      expect(files.status).toBe(403);
      expect(files.body).toMatchObject({ ...INSUFFICIENT_ACCESS, permission: 'files.invoke' });
      const importSample = await ctx.api().post('/sample-data/import').set(asUser(standardUser));
      expect(importSample.status).toBe(403);
      expect(importSample.body).toMatchObject({
        ...INSUFFICIENT_ACCESS,
        permission: 'sampleData.invoke',
      });
      // the admin group passes the guard (the import itself is ported by UNT3-18)
      expect((await ctx.api().post('/sample-data/import').set(asUser(adminUser))).status).not.toBe(
        403,
      );
    },
  );

  spec('no bearer token is 401 INVALID_SESSION_ID, never a silent 200 or a 403', async () => {
    const res = await ctx.api().get('/properties');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ output: { errors: [{ errorCode: 'INVALID_SESSION_ID' }] } });
  });

  spec(
    'fieldPermissions: formula fields are readable but a write is rejected (INVALID_FIELD_FOR_INSERT_UPDATE)',
    async () => {
      const { property } = await seed();
      for (const user of [standardUser, adminUser] as TestUser[]) {
        const res = await ctx
          .api()
          .patch(`/properties/${property.id}`)
          .set(asUser(user))
          .send({ daysOnMarket: 10 });
        expect(res.status).toBe(403);
        expect(res.body.output.fieldErrors.daysOnMarket[0].errorCode).toBe(
          'INVALID_FIELD_FOR_INSERT_UPDATE',
        );
      }
      const unchanged = await ctx.api().get(`/properties/${property.id}`).set(asUser(standardUser));
      expect(unchanged.body.name).toBe('Stunning Victorian');
    },
  );

  spec(
    'sharing: Public Read/Write + viewAll/modifyAll → records of other owners are visible and editable',
    async () => {
      const { property } = await seed();
      await ctx.prisma.db.property.update({
        where: { id: property.id },
        data: { ownerId: 'someone-else', price: 20000, beds: 3, baths: 3 },
      });
      // PropertyController.getPagedPropertyList('', 999999, 0, 0, 10, 1) as the standard user
      const list = await ctx
        .api()
        .get('/properties')
        .query({
          searchKey: '',
          maxPrice: 999999,
          minBedrooms: 0,
          minBathrooms: 0,
          pageSize: 10,
          pageNumber: 1,
        })
        .set(asUser(standardUser));
      expect(list.body.records.map((r: { id: string }) => r.id)).toContain(property.id);
      expect(
        (
          await ctx
            .api()
            .patch(`/properties/${property.id}`)
            .set(asUser(standardUser))
            .send({ city: 'Boston' })
        ).status,
      ).toBe(200);
      expect(
        (await ctx.api().delete(`/properties/${property.id}`).set(asUser(standardUser))).status,
      ).toBe(204);
    },
  );

  spec(
    'sharing: Contact (Controlled by Parent, no Account) → owner-only for the standard group, all for View All',
    async () => {
      await ctx.prisma.db.contact.createMany({
        data: [
          { lastName: 'Mine', ownerId: 'test-standarduser' },
          { lastName: 'Theirs', ownerId: 'someone-else' },
        ],
      });
      const mine = await ctx.api().get('/contacts').set(asUser(standardUser));
      expect(mine.status).toBe(200);
      expect(mine.body.map((c: { lastName: string }) => c.lastName)).toEqual(['Mine']);
      const all = await ctx.api().get('/contacts').set(asUser(adminUser));
      expect(all.body.map((c: { lastName: string }) => c.lastName)).toEqual(['Mine', 'Theirs']);
    },
  );

  spec('created records are owned by the running user (OwnerId / CreatedById)', async () => {
    const res = await ctx.api().post('/brokers').set(asUser(standardUser)).send({ name: 'Owned' });
    expect(res.status).toBe(201);
    const row = await ctx.prisma.db.broker.findUnique({ where: { id: res.body.id } });
    expect(row).toMatchObject({ ownerId: 'test-standarduser', createdBy: 'test-standarduser' });
  });
});
