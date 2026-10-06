/**
 * Characterisation of salesforce/force-app/main/default/classes/TestPropertyController.cls
 * (source: PropertyController.cls) against GET /properties and
 * GET /properties/:id/pictures.
 *
 * `System.runAs(testUser)` becomes a request with a bearer token for a user in
 * the `dreamhouse` Cognito group (tests/parity/fixtures/users.ts). Goes green
 * with plan step s4.2 / UNT3-16.
 */
import { describe, expect } from 'vitest';
import { useApiTestContext } from './harness/api-test-context';
import { characterise } from './harness/characterise';
import { createPicture, MOCK_PICTURE_NAME } from '../fixtures/files';
import { createProperties, createProperty } from '../fixtures/properties';
import { adminUser, standardUser, asUser } from '../fixtures/users';

const { spec } = characterise('TestPropertyController', 'UNT3-16');
const ctx = useApiTestContext();

function expectNoPictures(body: unknown) {
  // PropertyController.cls lines 94-96 return null when no ContentDocumentLink matches. Over HTTP the
  // "no pictures" answer is an empty collection (the propertyCarousel LWC treats null and [] identically);
  // a literal null body is tolerated too.
  expect(body === null || body === '' || (Array.isArray(body) && body.length === 0)).toBe(true);
}

describe('TestPropertyController', () => {
  spec('testGetPagedPropertyList', async () => {
    // TestPropertyController lines 22-52: a Standard User with the `dreamhouse` permission set
    // → `standardUser` in the `dreamhouse` group (fixtures/users.ts).
    const testUser = standardUser;

    // lines 55-57: System.runAs(admin) { createProperties(5); }
    await createProperties(ctx.prisma, 5);

    // lines 59-68: System.runAs(testUser) { PropertyController.getPagedPropertyList('', 999999, 0, 0, 10, 1); }
    const response = await ctx
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
      .set(asUser(testUser));
    expect(response.status).toBe(200);
    const result = response.body as {
      pageSize: number;
      pageNumber: number;
      totalItemCount: number;
      records: { id: string; name: string; price: number | null }[];
    };

    // line 70: Assert.areEqual(5, result.records.size()).
    expect(result.records).toHaveLength(5);

    // PropertyController.cls lines 34-36: PagedResult echoes the normalised paging inputs.
    expect(result.pageSize).toBe(10);
    expect(result.pageNumber).toBe(1);
    // PropertyController.cls lines 37-47: totalItemCount is the unpaged COUNT().
    expect(result.totalItemCount).toBe(5);
    // PropertyController.cls lines 48-61: each record carries the Apex SELECT list (camel-cased).
    for (const record of result.records) {
      expect(record).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.stringMatching(/^Name \d$/),
          price: 20000,
        }),
      );
      for (const field of [
        'address',
        'city',
        'state',
        'description',
        'baths',
        'beds',
        'thumbnail',
        'latitude',
        'longitude',
      ]) {
        expect(record, `record.${field}`).toHaveProperty(field);
      }
    }
  });

  spec('testGetPicturesNoResults', async () => {
    // TestPropertyController lines 76-77: insert new Property__c(Name = 'Name').
    const property = await createProperty(ctx.prisma, { name: 'Name' });

    // lines 79-83: PropertyController.getPictures(property.Id) in the test-running admin context.
    const response = await ctx
      .api()
      .get(`/properties/${property.id}/pictures`)
      .set(asUser(adminUser));
    expect(response.status).toBe(200);

    // line 85: Assert.isNull(items).
    expectNoPictures(response.body);
  });

  spec('testGetPicturesWithResults', async () => {
    // TestPropertyController lines 90-91: insert new Property__c(Name = 'Name').
    const property = await createProperty(ctx.prisma, { name: 'Name' });

    // lines 94-98: ContentVersion { Title = MOCK_PICTURE_NAME, PathOnClient = 'picture.png' }
    // lines 101-110: ContentDocumentLink { LinkedEntityId = property.Id, ShareType = 'V' }.
    await createPicture(ctx.api, {
      propertyId: property.id,
      title: MOCK_PICTURE_NAME,
      extension: 'png',
    });

    // lines 113-115: PropertyController.getPictures(property.Id).
    const response = await ctx
      .api()
      .get(`/properties/${property.id}/pictures`)
      .set(asUser(adminUser));
    expect(response.status).toBe(200);
    const items = response.body as {
      id: string;
      title: string;
      fileExtension: string;
      url: string;
    }[];

    // line 118: Assert.areEqual(1, items.size()).
    expect(items).toHaveLength(1);
    // line 119: Assert.areEqual(MOCK_PICTURE_NAME, items[0].Title).
    expect(items[0].title).toBe(MOCK_PICTURE_NAME);
    // PropertyController.cls lines 104-110: Id and Title of the latest version are returned;
    // PropertyPictureDto adds FileExtension and the S3 URL the carousel renders.
    expect(items[0].id).toEqual(expect.any(String));
    expect(items[0].fileExtension).toBe('png');
    expect(items[0].url).toEqual(expect.any(String));
  });

  spec('getPictures filters to PNG/JPG/GIF files', async () => {
    // Not an Apex test case, but PropertyController.cls line 90 (`ContentDocument.FileType IN ('PNG','JPG','GIF')`)
    // is behaviour the LWC relies on; pinned here so UNT3-16 cannot regress it silently.
    const property = await createProperty(ctx.prisma, { name: 'Name' });
    await createPicture(ctx.api, { propertyId: property.id, title: 'floorplan', extension: 'pdf' });
    await createPicture(ctx.api, {
      propertyId: property.id,
      title: MOCK_PICTURE_NAME,
      extension: 'jpg',
    });

    const response = await ctx
      .api()
      .get(`/properties/${property.id}/pictures`)
      .set(asUser(standardUser));
    expect(response.status).toBe(200);
    const items = response.body as { title: string }[];
    expect(items.map((item) => item.title)).toEqual([MOCK_PICTURE_NAME]);
  });
});
