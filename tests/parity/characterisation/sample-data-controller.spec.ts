/**
 * Characterisation of salesforce/force-app/main/default/classes/TestSampleDataController.cls
 * (source: SampleDataController.cls) against POST /sample-data/import.
 *
 * Goes green with plan step s4.4 / UNT3-18.
 */
import { describe, expect } from 'vitest';
import { useApiTestContext } from './harness/api-test-context';
import { characterise } from './harness/characterise';
import { adminUser, asUser } from '../fixtures/users';

const { spec } = characterise('TestSampleDataController', 'UNT3-18');
const ctx = useApiTestContext();

describe('TestSampleDataController', () => {
  spec('importSampleData', async () => {
    // TestSampleDataController lines 5-7: SampleDataController.importSampleData() as the
    // test-running administrator → POST /sample-data/import with a dreamhouse-admin token.
    const response = await ctx.api().post('/sample-data/import').set(asUser(adminUser)).send();
    // SampleDataController.importSampleData lines 4-11 is a void @AuraEnabled method: success, no body contract.
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);

    // lines 9-11: SELECT COUNT() FROM Property__c / Broker__c / Contact.
    const [propertyNumber, brokerNumber, contactNumber] = await Promise.all([
      ctx.prisma.db.property.count(),
      ctx.prisma.db.broker.count(),
      ctx.prisma.db.contact.count(),
    ]);

    // line 13: Assert.isTrue(propertyNumber > 0, 'Expected properties were created.').
    expect(propertyNumber, 'Expected properties were created.').toBeGreaterThan(0);
    // line 14: Assert.isTrue(brokerNumber > 0, 'Expected brokers were created.').
    expect(brokerNumber, 'Expected brokers were created.').toBeGreaterThan(0);
    // line 15: Assert.isTrue(contactNumber > 0, 'Expected contacts were created.').
    expect(contactNumber, 'Expected contacts were created.').toBeGreaterThan(0);
  });
});
