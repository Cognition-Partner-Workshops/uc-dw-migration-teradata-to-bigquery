import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsCalendarDate } from '../../../common/validation/is-calendar-date';

/** `Status__c` restricted picklist values (Property__c/fields/Status__c.field-meta.xml). */
export const PROPERTY_STATUSES = [
  'Contracted',
  'Pre Market',
  'Available',
  'Under Agreement',
  'Closed',
] as const;
export type PropertyStatusValue = (typeof PROPERTY_STATUSES)[number];

/** Create_property flow defaults (Create_property.flow-meta.xml: create_property + screen defaults). */
export const CREATE_PROPERTY_FLOW_DEFAULTS = {
  status: 'Available' satisfies PropertyStatusValue,
  price: 100000,
  beds: 4,
  baths: 2,
} as const;

/** Field sizes and ranges of Property__c (schema step: fields/*.field-meta.xml + migration CHECKs). */
export const PROPERTY_LIMITS = {
  name: 80,
  address: 100,
  city: 50,
  state: 20,
  zip: 10,
  tags: 255,
  url: 255,
  currency: 99_999_999.99, // Currency(8,2): abs(price) < 1e8
  assessedValue: 1e16, // Currency(16,2); the column CHECK is abs(assessed_value) < 1e18
  rooms: 99, // Number(2,0)
} as const;

const DATE = 'YYYY-MM-DD (Salesforce Date / Postgres date)';

/**
 * Full `Property__c` record (every field of the object; SOQL answers null for empty fields,
 * so does this JSON). Served by GET/POST/PATCH /properties/{id}.
 */
export class PropertyDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Original Salesforce Id while migrating',
    nullable: true,
    type: String,
  })
  sfId: string | null;

  @ApiProperty({ description: 'Property__c.Name' })
  name: string;

  @ApiProperty({ description: 'Address__c', nullable: true, type: String })
  address: string | null;

  @ApiProperty({ description: 'City__c', nullable: true, type: String })
  city: string | null;

  @ApiProperty({ description: 'State__c', nullable: true, type: String })
  state: string | null;

  @ApiProperty({ description: 'Zip__c', nullable: true, type: String })
  zip: string | null;

  @ApiProperty({ description: 'Description__c', nullable: true, type: String })
  description: string | null;

  @ApiProperty({ description: 'Tags__c', nullable: true, type: String })
  tags: string | null;

  @ApiProperty({ description: 'Price__c', nullable: true, type: Number })
  price: number | null;

  @ApiProperty({ description: 'Price_Sold__c', nullable: true, type: Number })
  priceSold: number | null;

  @ApiProperty({ description: 'Assessed_Value__c', nullable: true, type: Number })
  assessedValue: number | null;

  @ApiProperty({ description: 'Beds__c', nullable: true, type: Number })
  beds: number | null;

  @ApiProperty({ description: 'Baths__c', nullable: true, type: Number })
  baths: number | null;

  @ApiProperty({ description: 'Status__c', nullable: true, enum: PROPERTY_STATUSES })
  status: PropertyStatusValue | null;

  @ApiProperty({ description: `Date_Listed__c, ${DATE}`, nullable: true, type: String })
  dateListed: string | null;

  @ApiProperty({ description: `Date_Pre_Market__c, ${DATE}`, nullable: true, type: String })
  datePreMarket: string | null;

  @ApiProperty({ description: `Date_Contracted__c, ${DATE}`, nullable: true, type: String })
  dateContracted: string | null;

  @ApiProperty({ description: `Date_Agreement__c, ${DATE}`, nullable: true, type: String })
  dateAgreement: string | null;

  @ApiProperty({ description: `Date_Closed__c, ${DATE}`, nullable: true, type: String })
  dateClosed: string | null;

  @ApiProperty({ description: 'Location__Latitude__s', nullable: true, type: Number })
  latitude: number | null;

  @ApiProperty({ description: 'Location__Longitude__s', nullable: true, type: Number })
  longitude: number | null;

  @ApiProperty({ description: 'Picture__c', nullable: true, type: String })
  picture: string | null;

  @ApiProperty({ description: 'Thumbnail__c', nullable: true, type: String })
  thumbnail: string | null;

  @ApiProperty({ description: 'Broker__c (lookup)', nullable: true, type: String, format: 'uuid' })
  brokerId: string | null;

  @ApiProperty({ description: 'CreatedDate', format: 'date-time' })
  createdAt: string;

  @ApiProperty({ description: 'LastModifiedDate', format: 'date-time' })
  updatedAt: string;
}

/**
 * Body of POST /properties: the inputs of the Create_property screen flow (screens
 * new_property, address, property_details) plus every other writable Property__c field,
 * validated with the rules of the schema step. Omitted `status`/`dateListed` get the flow's
 * record-create values (`Available`, `$Flow.CurrentDate`).
 */
export class CreatePropertyDto {
  @ApiProperty({ description: 'Property__c.Name (flow: property_name, required)', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PROPERTY_LIMITS.name)
  name: string;

  @ApiPropertyOptional({
    description: 'Address__c (flow: property_address.street)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(PROPERTY_LIMITS.address)
  address?: string | null;

  @ApiPropertyOptional({ description: 'City__c (flow: property_address.city)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(PROPERTY_LIMITS.city)
  city?: string | null;

  @ApiPropertyOptional({ description: 'State__c (flow: property_address.province)', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(PROPERTY_LIMITS.state)
  state?: string | null;

  @ApiPropertyOptional({ description: 'Zip__c (flow: property_address.postalCode)', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(PROPERTY_LIMITS.zip)
  zip?: string | null;

  @ApiPropertyOptional({
    description:
      'Only used for geocoding (flow: property_address.country → geocode_address.country); not stored',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Description__c (flow: property_description)' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Tags__c (flow: property_tags)', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(PROPERTY_LIMITS.tags)
  tags?: string | null;

  @ApiPropertyOptional({
    description: 'Price__c (flow: property_price, screen default 100000)',
    minimum: -PROPERTY_LIMITS.currency,
    maximum: PROPERTY_LIMITS.currency,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-PROPERTY_LIMITS.currency)
  @Max(PROPERTY_LIMITS.currency)
  price?: number | null;

  @ApiPropertyOptional({
    description: 'Price_Sold__c',
    minimum: -PROPERTY_LIMITS.currency,
    maximum: PROPERTY_LIMITS.currency,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-PROPERTY_LIMITS.currency)
  @Max(PROPERTY_LIMITS.currency)
  priceSold?: number | null;

  @ApiPropertyOptional({ description: 'Assessed_Value__c' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-PROPERTY_LIMITS.assessedValue)
  @Max(PROPERTY_LIMITS.assessedValue)
  assessedValue?: number | null;

  @ApiPropertyOptional({
    description: 'Beds__c (flow: number_of_beds, screen default 4)',
    minimum: 0,
    maximum: 99,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(PROPERTY_LIMITS.rooms)
  beds?: number | null;

  @ApiPropertyOptional({
    description: 'Baths__c (flow: number_of_baths, screen default 2)',
    minimum: 0,
    maximum: 99,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(PROPERTY_LIMITS.rooms)
  baths?: number | null;

  @ApiPropertyOptional({
    description: 'Status__c restricted picklist; defaults to the flow value `Available`',
    enum: PROPERTY_STATUSES,
  })
  @IsOptional()
  @IsIn(PROPERTY_STATUSES)
  status?: PropertyStatusValue | null;

  @ApiPropertyOptional({
    description: `Date_Listed__c, ${DATE}; defaults to the current date ($Flow.CurrentDate)`,
  })
  @IsOptional()
  @IsCalendarDate()
  dateListed?: string | null;

  @ApiPropertyOptional({ description: `Date_Pre_Market__c, ${DATE}` })
  @IsOptional()
  @IsCalendarDate()
  datePreMarket?: string | null;

  @ApiPropertyOptional({ description: `Date_Contracted__c, ${DATE}` })
  @IsOptional()
  @IsCalendarDate()
  dateContracted?: string | null;

  @ApiPropertyOptional({ description: `Date_Agreement__c, ${DATE}` })
  @IsOptional()
  @IsCalendarDate()
  dateAgreement?: string | null;

  @ApiPropertyOptional({ description: `Date_Closed__c, ${DATE}` })
  @IsOptional()
  @IsCalendarDate()
  dateClosed?: string | null;

  @ApiPropertyOptional({
    description:
      'Location__Latitude__s; must be set together with longitude (ignored when geocode=true)',
    minimum: -90,
    maximum: 90,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({
    description:
      'Location__Longitude__s; must be set together with latitude (ignored when geocode=true)',
    minimum: -180,
    maximum: 180,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiPropertyOptional({ description: 'Picture__c', format: 'uri', maxLength: 255 })
  @IsOptional()
  @IsUrl()
  @MaxLength(PROPERTY_LIMITS.url)
  picture?: string | null;

  @ApiPropertyOptional({ description: 'Thumbnail__c', format: 'uri', maxLength: 255 })
  @IsOptional()
  @IsUrl()
  @MaxLength(PROPERTY_LIMITS.url)
  thumbnail?: string | null;

  @ApiPropertyOptional({
    description: 'Broker__c lookup (flow: property_broker.recordId)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  brokerId?: string | null;

  @ApiPropertyOptional({
    description:
      'Create_property flow option: run the geocode_address action (Apex GeocodingService → Nominatim) on address/city/state/country/zip and store the result as latitude/longitude. A geocoder failure answers 502 GEOCODING_FAULT (flow fault path) and creates nothing.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  geocode?: boolean;
}

/**
 * Body of PATCH /properties/{id}: any subset of the create fields. `null` clears an optional
 * field (LDS `updateRecord` semantics); `name` cannot be cleared.
 */
export class UpdatePropertyDto extends PartialType(OmitType(CreatePropertyDto, ['name'] as const)) {
  @ApiPropertyOptional({ description: 'Property__c.Name', maxLength: 80 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(PROPERTY_LIMITS.name)
  name?: string;
}
