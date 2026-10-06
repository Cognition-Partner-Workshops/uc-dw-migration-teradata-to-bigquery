import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SAMPLE_BROKERS,
  SAMPLE_CONTACTS,
  SAMPLE_PROPERTIES,
  SampleDataService,
} from './sample-data.service';

const STATIC_RESOURCES = join(
  __dirname,
  '../../../../../salesforce/force-app/main/default/staticresources',
);

function staticResource(name: string): Record<string, unknown>[] {
  return JSON.parse(readFileSync(join(STATIC_RESOURCES, `${name}.json`), 'utf8'));
}

describe('sample data fixtures mirror the Salesforce static resources', () => {
  it('sample_data_brokers.json', () => {
    const source = staticResource('sample_data_brokers');
    expect(SAMPLE_BROKERS).toHaveLength(source.length);
    source.forEach((broker, index) => {
      expect(SAMPLE_BROKERS[index]).toEqual({
        brokerId: broker.Broker_Id__c,
        name: broker.Name,
        title: broker.Title__c,
        phone: broker.Phone__c,
        mobilePhone: broker.Mobile_Phone__c,
        email: broker.Email__c,
        picture: broker.Picture__c,
      });
    });
  });

  it('sample_data_properties.json', () => {
    const source = staticResource('sample_data_properties');
    expect(SAMPLE_PROPERTIES).toHaveLength(source.length);
    source.forEach((property, index) => {
      expect(SAMPLE_PROPERTIES[index]).toEqual({
        name: property.Name,
        address: property.Address__c,
        city: property.City__c,
        state: property.State__c,
        zip: property.Zip__c,
        price: property.Price__c,
        beds: property.Beds__c,
        baths: property.Baths__c,
        locationLongitude: property.Location__Longitude__s,
        locationLatitude: property.Location__Latitude__s,
        picture: property.Picture__c,
        thumbnail: property.Thumbnail__c,
        tags: property.Tags__c,
        description: property.Description__c,
        brokerId: (property.Broker__r as { Broker_Id__c: number }).Broker_Id__c,
        status: property.Status__c,
      });
    });
  });

  it('sample_data_contacts.json', () => {
    const source = staticResource('sample_data_contacts');
    expect(SAMPLE_CONTACTS).toHaveLength(source.length);
    source.forEach((contact, index) => {
      expect(SAMPLE_CONTACTS[index]).toEqual({
        firstName: contact.FirstName,
        lastName: contact.LastName,
        phone: contact.Phone,
        email: contact.Email,
      });
    });
  });
});

describe('SampleDataService.importSampleData', () => {
  const tx = {
    property: { deleteMany: vi.fn(), createMany: vi.fn() },
    broker: { deleteMany: vi.fn(), createManyAndReturn: vi.fn() },
    contact: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;
  const service = new SampleDataService(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
    tx.property.deleteMany.mockResolvedValue({ count: 3 });
    tx.broker.deleteMany.mockResolvedValue({ count: 2 });
    tx.contact.deleteMany.mockResolvedValue({ count: 1 });
    tx.broker.createManyAndReturn.mockImplementation(
      ({ data }: { data: { brokerId: Prisma.Decimal }[] }) =>
        Promise.resolve(
          data.map((row, index) => ({ id: `broker-${index + 1}`, brokerId: row.brokerId })),
        ),
    );
    tx.property.createMany.mockImplementation(({ data }: { data: unknown[] }) =>
      Promise.resolve({ count: data.length }),
    );
    tx.contact.createMany.mockImplementation(({ data }: { data: unknown[] }) =>
      Promise.resolve({ count: data.length }),
    );
  });

  it('deletes properties, brokers, contacts then inserts the three resources in one transaction', async () => {
    const result = await service.importSampleData();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      deleted: { properties: 3, brokers: 2, contacts: 1 },
      inserted: {
        brokers: SAMPLE_BROKERS.length,
        properties: SAMPLE_PROPERTIES.length,
        contacts: SAMPLE_CONTACTS.length,
      },
    });
    // SampleDataController.importSampleData lines 4-11: delete Property__c, Broker__c, Contact; insert brokers, properties, contacts.
    const order = [
      tx.property.deleteMany,
      tx.broker.deleteMany,
      tx.contact.deleteMany,
      tx.broker.createManyAndReturn,
      tx.property.createMany,
      tx.contact.createMany,
    ].map((fn) => fn.mock.invocationCallOrder[0]);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('resolves Broker__r.Broker_Id__c to the inserted broker and Status__c to the enum', async () => {
    await service.importSampleData();

    const { data } = tx.property.createMany.mock.calls[0][0] as {
      data: {
        name: string;
        brokerId: string | null;
        status: string | null;
        dateListed: Date;
        price: Prisma.Decimal;
      }[];
    };
    const victorian = data.find((row) => row.name === 'Stunning Victorian')!;
    expect(victorian.brokerId).toBe('broker-1');
    expect(victorian.status).toBe('Available');
    expect(victorian.price.toString()).toBe('975000');
    expect(victorian.dateListed).toBeInstanceOf(Date);
    const statuses = new Set(data.map((row) => row.status));
    expect(statuses).toEqual(
      new Set(['Available', 'Closed', 'Contracted', 'PreMarket', 'UnderAgreement']),
    );
    expect(data.every((row) => row.brokerId !== null && row.brokerId !== undefined)).toBe(true);
  });

  it('randomizeDateListed is today minus 0..89 days at UTC midnight (System.today() - random * 90)', () => {
    const today = new Date('2026-10-06T15:30:00Z');
    expect(service.randomizeDateListed(today, () => 0).toISOString()).toBe(
      '2026-10-06T00:00:00.000Z',
    );
    expect(service.randomizeDateListed(today, () => 0.999999).toISOString()).toBe(
      '2026-07-09T00:00:00.000Z',
    );
    expect(service.randomizeDateListed(today, () => 0.5).toISOString()).toBe(
      '2026-08-22T00:00:00.000Z',
    );
  });
});
