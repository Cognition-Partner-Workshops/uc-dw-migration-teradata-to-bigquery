import { Injectable, NotFoundException } from '@nestjs/common';
import { assertRecordAccess, ownershipColumns, recordAccessWhere } from '../../auth/sharing';
import { ERROR_CODES } from '../../common/errors/api-error.dto';
import {
  FieldErrorsException,
  GeocodingFaultException,
} from '../../common/errors/field-errors.exception';
import {
  currentDate,
  fromCalendarDate,
  toCalendarDate,
} from '../../common/validation/is-calendar-date';
import { Prisma, PropertyStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { PropertyQueryDto } from './dto/property-query.dto';
import {
  CREATE_PROPERTY_FLOW_DEFAULTS,
  CreatePropertyDto,
  PropertyDto,
  PropertyStatusValue,
  UpdatePropertyDto,
} from './dto/property-record.dto';
import { PagedPropertiesDto, PropertyPictureDto, PropertySummaryDto } from './dto/property.dto';

/** `ContentDocument.FileType IN ('PNG', 'JPG', 'GIF')` (PropertyController.cls line 90). */
export const PICTURE_FILE_TYPES = ['PNG', 'JPG', 'GIF'] as const;

/** `SELECT Id, Name, Address__c, ... Location__Longitude__s FROM Property__c` (PropertyController.cls lines 48-61). */
const PROPERTY_SUMMARY_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  description: true,
  price: true,
  baths: true,
  beds: true,
  thumbnail: true,
  locationLatitude: true,
  locationLongitude: true,
} satisfies Prisma.PropertySelect;

type PropertySummaryRow = Prisma.PropertyGetPayload<{ select: typeof PROPERTY_SUMMARY_SELECT }>;

const toNumber = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : value.toNumber();

type PropertyRow = Prisma.PropertyGetPayload<Record<string, never>>;
/** Column values of a request body; `name` is only optional on PATCH. */
type PropertyData = Omit<Prisma.PropertyUncheckedCreateInput, 'name'> & { name?: string };

/** API picklist value (`Pre Market`) ↔ Prisma enum member (`PreMarket`); the DB stores the picklist value. */
const STATUS_TO_ENUM: Record<PropertyStatusValue, PropertyStatus> = {
  Contracted: PropertyStatus.Contracted,
  'Pre Market': PropertyStatus.PreMarket,
  Available: PropertyStatus.Available,
  'Under Agreement': PropertyStatus.UnderAgreement,
  Closed: PropertyStatus.Closed,
};
const ENUM_TO_STATUS = Object.fromEntries(
  Object.entries(STATUS_TO_ENUM).map(([value, member]) => [member, value]),
) as Record<PropertyStatus, PropertyStatusValue>;

const STRING_FIELDS = [
  'address',
  'city',
  'state',
  'zip',
  'description',
  'tags',
  'picture',
  'thumbnail',
  'brokerId',
] as const;
const DECIMAL_FIELDS = ['price', 'priceSold', 'assessedValue'] as const;
const INT_FIELDS = ['beds', 'baths'] as const;
const DATE_FIELDS = [
  'dateListed',
  'datePreMarket',
  'dateContracted',
  'dateAgreement',
  'dateClosed',
] as const;

/** Writable Property__c fields of a request body → Prisma column values (undefined = leave untouched). */
function toData(input: UpdatePropertyDto): PropertyData {
  const data: PropertyData = {};
  if (input.name !== undefined) data.name = input.name;
  for (const key of STRING_FIELDS) if (input[key] !== undefined) data[key] = input[key];
  for (const key of INT_FIELDS) if (input[key] !== undefined) data[key] = input[key];
  for (const key of DECIMAL_FIELDS) {
    const value = input[key];
    if (value !== undefined) data[key] = value === null ? null : new Prisma.Decimal(value);
  }
  for (const key of DATE_FIELDS) {
    const value = input[key];
    if (value !== undefined) data[key] = value === null ? null : fromCalendarDate(value);
  }
  if (input.status !== undefined) {
    data.status = input.status === null ? null : STATUS_TO_ENUM[input.status];
  }
  if (input.latitude !== undefined) {
    data.locationLatitude = input.latitude === null ? null : new Prisma.Decimal(input.latitude);
  }
  if (input.longitude !== undefined) {
    data.locationLongitude = input.longitude === null ? null : new Prisma.Decimal(input.longitude);
  }
  return data;
}

/**
 * The Broker__c lookup must point at an existing record (Salesforce: INVALID_CROSS_REFERENCE_KEY on
 * DML). Checked in the write transaction so the FOREIGN KEY stays a safety net rather than the answer.
 */
async function assertBrokerExists(
  tx: Pick<Prisma.TransactionClient, 'broker'>,
  brokerId: PropertyData['brokerId'],
): Promise<void> {
  if (typeof brokerId !== 'string') return;
  const broker = await tx.broker.findUnique({ where: { id: brokerId }, select: { id: true } });
  if (!broker) {
    throw FieldErrorsException.forField(
      'brokerId',
      ERROR_CODES.invalidCrossReference,
      'brokerId refers to a record that does not exist',
    );
  }
}

/** `Location__c` is one compound field in Salesforce: both halves set, or neither (CHECK properties_location_check). */
function assertLocationPaired(latitude: unknown, longitude: unknown): void {
  if (
    (latitude === null || latitude === undefined) ===
    (longitude === null || longitude === undefined)
  )
    return;
  const missing = latitude === null || latitude === undefined ? 'latitude' : 'longitude';
  throw FieldErrorsException.forField(
    missing,
    ERROR_CODES.fieldIntegrity,
    'latitude and longitude must be set together',
  );
}

/**
 * Home of Apex `PropertyController` (+ `TestPropertyController`).
 * Both methods were `@AuraEnabled(cacheable=true)`: the controller answers them on GET with
 * `Cache-Control` and the web caches them through TanStack Query (app/web/src/api/queries.ts).
 */
@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
  ) {}

  /**
   * `PropertyController.getPagedPropertyList(searchKey, maxPrice, minBedrooms, minBathrooms, pageSize, pageNumber)`.
   * Input defaults (`?? DEFAULT_MAX_PRICE`, `?? 0`, `?? 9`, `?? 1`) are applied by PropertyQueryDto.
   */
  async getPagedPropertyList(query: PropertyQueryDto): Promise<PagedPropertiesDto> {
    // `WITH USER_MODE` (lines 46, 73): sharing of the running user — empty for Public Read/Write + View All.
    const where = {
      ...PropertiesService.searchWhere(query),
      ...recordAccessWhere('Property__c', 'read'),
    };
    const offset = (query.pageNumber - 1) * query.pageSize;

    const [totalItemCount, rows] = await this.prisma.$transaction([
      // `SELECT COUNT() FROM Property__c WHERE ...` (lines 37-47)
      this.prisma.property.count({ where }),
      // `SELECT ... FROM Property__c WHERE ... ORDER BY Price__c LIMIT :pageSize OFFSET :offset` (lines 48-74)
      this.prisma.property.findMany({
        where,
        select: PROPERTY_SUMMARY_SELECT,
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
        take: query.pageSize,
        skip: offset,
      }),
    ]);

    return {
      pageSize: query.pageSize,
      pageNumber: query.pageNumber,
      totalItemCount,
      records: rows.map(PropertiesService.toSummary),
    };
  }

  /**
   * `PropertyController.getPictures(propertyId)`: ContentDocumentLinks of the record whose
   * ContentDocument.FileType is a picture, then the latest ContentVersion of each ordered by
   * CreatedDate. The two SOQL queries collapse into one over `files`. Apex returns null when
   * nothing is linked; over HTTP that is an empty array (the carousel treats both the same).
   */
  async getPictures(propertyId: string): Promise<PropertyPictureDto[]> {
    const files = await this.prisma.file.findMany({
      where: { recordId: propertyId, fileType: { in: [...PICTURE_FILE_TYPES] } },
      select: { id: true, title: true, fileType: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return files.map((file) => ({
      id: file.id,
      title: file.title,
      fileExtension: file.fileType.toLowerCase(),
      url: `/files/${file.id}`,
    }));
  }

  /**
   * `(Name LIKE :p OR City__c LIKE :p OR Tags__c LIKE :p) AND Price__c <= :maxPrice AND Beds__c >= :minBedrooms
   * AND Baths__c >= :minBathrooms` with `p = '%' + searchKey + '%'`. SOQL LIKE is case-insensitive, hence
   * `mode: 'insensitive'` (ILIKE, served by the pg_trgm indexes). Null Price/Beds/Baths never satisfy a
   * SOQL comparison and never satisfy the Prisma filters either. `brokerId` narrows the list to one
   * broker's properties (the Broker record page's `Properties__r` related list).
   */
  static searchWhere(query: PropertyQueryDto): Prisma.PropertyWhereInput {
    const searchKey = query.searchKey ?? '';
    const like = { contains: searchKey, mode: 'insensitive' as const };
    return {
      OR: [{ name: like }, { city: like }, { tags: like }],
      price: { lte: query.maxPrice },
      beds: { gte: query.minBedrooms },
      baths: { gte: query.minBathrooms },
      ...(query.brokerId ? { brokerId: query.brokerId } : {}),
    };
  }

  // ----------------------------------------------------------------------------------------
  // Record CRUD: what Lightning Data Service / the Property record page did implicitly, plus
  // the Create_property screen flow. Dreamhouse has no triggers or record-triggered flows
  // (docs/migration/inventory.json: apexTriggers 0, flows: Create_property only), so there are
  // no domain hooks; one would run on `tx` inside the `$transaction` of create/update/remove.
  // ----------------------------------------------------------------------------------------

  /** LDS `getRecord(Property__c)` (propertySummary, propertyLocation, propertyMap, record page). */
  async findOne(id: string): Promise<PropertyDto> {
    const row = await this.prisma.property.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Property not found');
    assertRecordAccess('Property__c', 'read', row);
    return PropertiesService.toRecord(row);
  }

  /**
   * `Create_property` flow in one call. Flow element → here:
   * - screens new_property / address / property_details → the DTO fields;
   * - `geocode_address` (Apex GeocodingService) → `GeocodingService.geocodeAddress` when
   *   `geocode: true`; its fault connector (Error5 screen) → `GeocodingFaultException`, no insert;
   * - `create_property` (Record Create) → the insert, with its literal assignments
   *   `Status__c = 'Available'` and `Date_Listed__c = $Flow.CurrentDate` applied when omitted;
   * - `upload_picture` / `update_picture_fields` → `POST /files` on the returned id (UNT3-18);
   * - its fault connector → the 4xx the validation pipe / PrismaExceptionFilter answer.
   */
  async create(input: CreatePropertyDto): Promise<PropertyDto> {
    const { geocode, country, ...fields } = input;
    const data = {
      ...toData(fields),
      ...ownershipColumns(),
    } as Prisma.PropertyUncheckedCreateInput;
    data.status ??= STATUS_TO_ENUM[CREATE_PROPERTY_FLOW_DEFAULTS.status];
    data.dateListed ??= fromCalendarDate(currentDate());

    if (geocode) {
      Object.assign(data, await this.geocodeLocation({ ...fields, country }));
    }
    assertLocationPaired(data.locationLatitude, data.locationLongitude);

    return this.prisma.$transaction(async (tx) => {
      await assertBrokerExists(tx, data.brokerId);
      const row = await tx.property.create({ data });
      return PropertiesService.toRecord(row);
    });
  }

  /** LDS `updateRecord(Property__c)`; `geocode: true` re-runs the flow's geocode step on the merged address. */
  async update(id: string, input: UpdatePropertyDto): Promise<PropertyDto> {
    const { geocode, country, ...fields } = input;
    const current = await this.prisma.property.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Property not found');
    assertRecordAccess('Property__c', 'edit', current);
    const data = toData(fields);

    if (geocode) {
      Object.assign(
        data,
        await this.geocodeLocation({
          address: fields.address === undefined ? current.address : fields.address,
          city: fields.city === undefined ? current.city : fields.city,
          state: fields.state === undefined ? current.state : fields.state,
          zip: fields.zip === undefined ? current.zip : fields.zip,
          country,
        }),
      );
    }
    assertLocationPaired(
      data.locationLatitude === undefined ? current.locationLatitude : data.locationLatitude,
      data.locationLongitude === undefined ? current.locationLongitude : data.locationLongitude,
    );

    return this.prisma.$transaction(async (tx) => {
      await assertBrokerExists(tx, data.brokerId);
      const row = await tx.property.update({ where: { id }, data });
      return PropertiesService.toRecord(row);
    });
  }

  /** LDS `deleteRecord(Property__c)`; `files` rows cascade (ContentDocumentLink). 404 via P2025. */
  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.property.findUnique({ where: { id }, select: { ownerId: true } });
      if (!current) throw new NotFoundException('Property not found');
      assertRecordAccess('Property__c', 'delete', current);
      await tx.property.delete({ where: { id } });
    });
  }

  /**
   * Flow `geocode_address`: `GeocodingService.geocodeAddresses` with street/city/state/country/
   * postalcode from the address screen; the Apex returned null coordinates on a non-200
   * answer (record still created with an empty Location__c) and faulted on a callout error.
   */
  private async geocodeLocation(address: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  }): Promise<Pick<PropertyData, 'locationLatitude' | 'locationLongitude'>> {
    try {
      const coords = await this.geocoding.geocodeAddress(
        {
          street: address.address ?? undefined,
          city: address.city ?? undefined,
          state: address.state ?? undefined,
          country: address.country ?? undefined,
          postalcode: address.zip ?? undefined,
        },
        { onError: 'throw' },
      );
      return {
        locationLatitude: coords.lat === null ? null : new Prisma.Decimal(coords.lat),
        locationLongitude: coords.lon === null ? null : new Prisma.Decimal(coords.lon),
      };
    } catch (error) {
      throw new GeocodingFaultException((error as Error).message);
    }
  }

  static toRecord(row: PropertyRow): PropertyDto {
    return {
      id: row.id,
      sfId: row.sfId,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      description: row.description,
      tags: row.tags,
      price: toNumber(row.price),
      priceSold: toNumber(row.priceSold),
      assessedValue: toNumber(row.assessedValue),
      beds: row.beds,
      baths: row.baths,
      status: row.status === null ? null : ENUM_TO_STATUS[row.status],
      dateListed: toCalendarDate(row.dateListed),
      datePreMarket: toCalendarDate(row.datePreMarket),
      dateContracted: toCalendarDate(row.dateContracted),
      dateAgreement: toCalendarDate(row.dateAgreement),
      dateClosed: toCalendarDate(row.dateClosed),
      latitude: toNumber(row.locationLatitude),
      longitude: toNumber(row.locationLongitude),
      picture: row.picture,
      thumbnail: row.thumbnail,
      brokerId: row.brokerId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  static toSummary(row: PropertySummaryRow): PropertySummaryDto {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      description: row.description,
      price: toNumber(row.price),
      baths: row.baths,
      beds: row.beds,
      thumbnail: row.thumbnail,
      latitude: toNumber(row.locationLatitude),
      longitude: toNumber(row.locationLongitude),
    };
  }
}
