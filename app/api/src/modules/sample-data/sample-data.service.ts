import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PropertyStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SampleDataImportResultDto } from './dto/sample-data.dto';
import brokersJson from './fixtures/brokers.json';
import contactsJson from './fixtures/contacts.json';
import propertiesJson from './fixtures/properties.json';

type Tx = Prisma.TransactionClient;

/** sample_data_brokers.json (keys renamed to the Prisma field names). */
export interface SampleBroker {
  brokerId: number;
  name: string;
  title?: string;
  phone?: string;
  mobilePhone?: string;
  email?: string;
  picture?: string;
}

/** sample_data_properties.json; `brokerId` is `Broker__r.Broker_Id__c` (the external id). */
export interface SampleProperty {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  locationLongitude?: number;
  locationLatitude?: number;
  picture?: string;
  thumbnail?: string;
  tags?: string;
  description?: string;
  brokerId?: number;
  status?: string;
}

/** sample_data_contacts.json */
export interface SampleContact {
  firstName?: string;
  lastName: string;
  phone?: string;
  email?: string;
}

export const SAMPLE_BROKERS: readonly SampleBroker[] = brokersJson;
export const SAMPLE_PROPERTIES: readonly SampleProperty[] = propertiesJson;
export const SAMPLE_CONTACTS: readonly SampleContact[] = contactsJson;

/** Status__c picklist labels -> property_status enum (Prisma maps PreMarket to 'Pre Market' etc.). */
const PROPERTY_STATUS_BY_LABEL: Record<string, PropertyStatus> = {
  Contracted: PropertyStatus.Contracted,
  'Pre Market': PropertyStatus.PreMarket,
  Available: PropertyStatus.Available,
  'Under Agreement': PropertyStatus.UnderAgreement,
  Closed: PropertyStatus.Closed,
};

/**
 * Port of Apex `SampleDataController` (Settings tab, sampleDataImporter LWC). The static resources
 * `sample_data_brokers/properties/contacts` are bundled under ./fixtures with the same content.
 */
@Injectable()
export class SampleDataService {
  private readonly logger = new Logger(SampleDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * `importSampleData()`: `delete [SELECT Id FROM Case]` has no counterpart (no Case table);
   * properties, brokers and contacts are deleted (files rows cascade with their property) and the
   * three static resources are inserted, all in one transaction instead of one Apex request.
   */
  async importSampleData(): Promise<SampleDataImportResultDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = {
        properties: (await tx.property.deleteMany()).count,
        brokers: (await tx.broker.deleteMany()).count,
        contacts: (await tx.contact.deleteMany()).count,
      };
      const brokerIds = await this.insertBrokers(tx);
      const properties = await this.insertProperties(tx, brokerIds);
      const contacts = await this.insertContacts(tx);
      return { deleted, inserted: { brokers: brokerIds.size, properties, contacts } };
    });
    this.logger.log(result, 'sample data imported');
    return result;
  }

  /** `insertBrokers()`; returns Broker_Id__c -> brokers.id so properties can resolve `Broker__r`. */
  async insertBrokers(tx: Tx): Promise<Map<number, string>> {
    const rows = await tx.broker.createManyAndReturn({
      data: SAMPLE_BROKERS.map((broker) => ({
        name: broker.name,
        brokerId: new Prisma.Decimal(broker.brokerId),
        title: broker.title ?? null,
        phone: broker.phone ?? null,
        mobilePhone: broker.mobilePhone ?? null,
        email: broker.email ?? null,
        picture: broker.picture ?? null,
      })),
      select: { id: true, brokerId: true },
    });
    return new Map(rows.map((row) => [Number(row.brokerId), row.id]));
  }

  /** `insertProperties()`: Broker__r.Broker_Id__c resolved to the broker row, Date_Listed__c randomised. */
  async insertProperties(tx: Tx, brokerIds: ReadonlyMap<number, string>): Promise<number> {
    const today = new Date();
    const data = SAMPLE_PROPERTIES.map((property) => {
      const status =
        property.status === undefined ? null : PROPERTY_STATUS_BY_LABEL[property.status];
      if (property.status !== undefined && !status) {
        throw new Error(
          `sample property "${property.name}" has unknown status "${property.status}"`,
        );
      }
      const brokerId = property.brokerId === undefined ? null : brokerIds.get(property.brokerId);
      if (property.brokerId !== undefined && !brokerId) {
        throw new Error(
          `sample property "${property.name}" references unknown broker ${property.brokerId}`,
        );
      }
      return {
        name: property.name,
        address: property.address ?? null,
        city: property.city ?? null,
        state: property.state ?? null,
        zip: property.zip ?? null,
        price: property.price === undefined ? null : new Prisma.Decimal(property.price),
        beds: property.beds ?? null,
        baths: property.baths ?? null,
        locationLatitude:
          property.locationLatitude === undefined
            ? null
            : new Prisma.Decimal(property.locationLatitude),
        locationLongitude:
          property.locationLongitude === undefined
            ? null
            : new Prisma.Decimal(property.locationLongitude),
        picture: property.picture ?? null,
        thumbnail: property.thumbnail ?? null,
        tags: property.tags ?? null,
        description: property.description ?? null,
        status,
        brokerId,
        dateListed: this.randomizeDateListed(today),
      };
    });
    const { count } = await tx.property.createMany({ data });
    return count;
  }

  /** `insertContacts()` */
  async insertContacts(tx: Tx): Promise<number> {
    const { count } = await tx.contact.createMany({
      data: SAMPLE_CONTACTS.map((contact) => ({
        firstName: contact.firstName ?? null,
        lastName: contact.lastName,
        phone: contact.phone ?? null,
        email: contact.email ?? null,
      })),
    });
    return count;
  }

  /** `System.today() - Integer.valueOf(Math.random() * 90)` as a date-only value (UTC midnight). */
  randomizeDateListed(today: Date, random: () => number = Math.random): Date {
    const daysAgo = Math.floor(random() * 90);
    return new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysAgo),
    );
  }
}
