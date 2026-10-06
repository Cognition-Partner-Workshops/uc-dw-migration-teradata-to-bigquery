/**
 * Characterisation of salesforce/force-app/main/default/classes/FileUtilitiesTest.cls
 * (source: FileUtilities.cls) against POST /files.
 *
 * `AuraHandledException` from FileUtilities.createFile (lines 29-31) surfaces
 * to the LWC as a failed call; the API contract for that is a 4xx response
 * (ValidationPipe / BadRequestException / NotFoundException), never a 5xx.
 * Goes green with plan step s4.4 / UNT3-18.
 */
import { describe, expect } from 'vitest';
import { useApiTestContext } from './harness/api-test-context';
import { characterise } from './harness/characterise';
import { VALID_BASE64_DATA } from '../fixtures/files';
import { createProperty } from '../fixtures/properties';
import { adminUser, standardUser, asUser } from '../fixtures/users';

const { spec } = characterise('FileUtilitiesTest', 'UNT3-18');
const ctx = useApiTestContext();

async function createFile(body: { base64Data: string; filename: string; recordId: string }) {
  // FileUtilities.createFile(base64Data, filename, recordId) → POST /files. FileUtilitiesTest has no
  // runAs: it runs as the test context's System Administrator, and the `dreamhouse` permission set
  // grants no access to the FileUtilities class (a Standard User gets 403, see permission-set.spec.ts).
  return ctx.api().post('/files').set(asUser(adminUser)).send(body);
}

function expectAuraHandledException(response: { status: number; body: unknown }) {
  // FileUtilities.cls lines 29-31: any failure is rethrown as AuraHandledException → HTTP 4xx here.
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
  // A missing route is also a 4xx; make sure the endpoint itself rejected the call.
  expect(String((response.body as { message?: unknown }).message)).not.toMatch(
    /^Cannot (POST|GET) /,
  );
}

async function expectNoPictures(propertyId: string) {
  // FileUtilities.cls lines 9-13 fail before the link insert, so the record keeps no file.
  const pictures = await ctx
    .api()
    .get(`/properties/${propertyId}/pictures`)
    .set(asUser(standardUser));
  expect(pictures.status).toBe(200);
  const body = pictures.body as unknown;
  expect(body === null || body === '' || (Array.isArray(body) && body.length === 0)).toBe(true);
}

describe('FileUtilitiesTest', () => {
  spec('createFileSucceedsWhenCorrectInput', async () => {
    // GIVEN — FileUtilitiesTest.createFileSucceedsWhenCorrectInput lines 6-7: insert new Property__c().
    const property = await createProperty(ctx.prisma);
    // lines 9-11: validBase64Data (the 1x1 JPEG), fileName 'file.png', recordId = property.Id.
    const base64Data = VALID_BASE64_DATA;
    const fileName = 'file.png';
    const recordId = property.id;

    // WHEN — lines 14-18.
    const response = await createFile({ base64Data, filename: fileName, recordId });
    expect(response.status).toBe(201);
    const contentDocumentLinkId = (response.body as { id?: string }).id;

    // THEN — line 21: Assert.isNotNull(contentDocumentLinkId).
    expect(contentDocumentLinkId).not.toBeNull();
    expect(contentDocumentLinkId).toBeDefined();
    // FileUtilities.cls line 28 returns the ContentDocumentLink.Id; FileCreatedDto also carries the S3 url.
    expect((response.body as { url?: string }).url).toEqual(expect.any(String));
  });

  spec('createFileFailsWhenIncorrectRecordId', async () => {
    // GIVEN — FileUtilitiesTest.createFileFailsWhenIncorrectRecordId lines 27-29.
    const base64Data = VALID_BASE64_DATA;
    const fileName = 'file.png';
    const recordId = 'INVALID_ID';

    // WHEN — lines 33-37; FileUtilities.cls lines 24-26: the ContentDocumentLink insert rejects the bogus id.
    const response = await createFile({ base64Data, filename: fileName, recordId });

    // THEN — line 38 Assert.fail / line 41 Assert.isInstanceOfType(e, AuraHandledException.class).
    expectAuraHandledException(response);
  });

  spec('createFileFailsWhenIncorrectBase64Data', async () => {
    // GIVEN — FileUtilitiesTest.createFileFailsWhenIncorrectBase64Data lines 48-49: insert new Property__c().
    const property = await createProperty(ctx.prisma);
    // lines 51-53: empty base64Data.
    const base64Data = '';
    const fileName = 'file.png';
    const recordId = property.id;

    // WHEN — lines 57-61; FileUtilities.cls line 10: EncodingUtil.base64Decode('') fails the insert.
    const response = await createFile({ base64Data, filename: fileName, recordId });

    // THEN — line 62 Assert.fail / line 65 Assert.isInstanceOfType(e, AuraHandledException.class).
    expectAuraHandledException(response);
    await expectNoPictures(recordId);
  });

  spec('createFileFailsWhenIncorrectFilename', async () => {
    // GIVEN — FileUtilitiesTest.createFileFailsWhenIncorrectFilename lines 72-73: insert new Property__c().
    const property = await createProperty(ctx.prisma);
    // lines 75-77: valid data, empty fileName.
    const base64Data = VALID_BASE64_DATA;
    const fileName = '';
    const recordId = property.id;

    // WHEN — lines 81-85; FileUtilities.cls lines 11-13: a blank Title/PathOnClient fails the ContentVersion insert.
    const response = await createFile({ base64Data, filename: fileName, recordId });

    // THEN — line 86 Assert.fail / line 89 Assert.isInstanceOfType(e, AuraHandledException.class).
    expectAuraHandledException(response);
    await expectNoPictures(recordId);
  });
});
