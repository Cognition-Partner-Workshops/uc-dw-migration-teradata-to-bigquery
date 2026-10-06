import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Field sizes of Broker__c (schema step: fields/*.field-meta.xml + migration CHECKs). */
export const BROKER_LIMITS = {
  name: 80,
  title: 30,
  phone: 40,
  mobilePhone: 40,
  email: 80,
  picture: 255,
} as const;

/** Broker_Id__c is Number(18,0): travels as a digit string so 18-digit ids survive JSON. */
const BROKER_ID = /^-?\d{1,18}$/;

/**
 * Full `Broker__c` record as shown by the brokerCard LWC and the Broker record page
 * (SOQL answers null for empty fields; so does this JSON).
 */
export class BrokerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Original Salesforce Id while migrating',
    nullable: true,
    type: String,
  })
  sfId: string | null;

  @ApiProperty({ description: 'Broker__c.Name' })
  name: string;

  @ApiProperty({
    description: 'Broker_Id__c (Number 18,0) as a digit string',
    nullable: true,
    type: String,
  })
  brokerId: string | null;

  @ApiProperty({ description: 'Title__c', nullable: true, type: String })
  title: string | null;

  @ApiProperty({ description: 'Email__c', nullable: true, type: String, format: 'email' })
  email: string | null;

  @ApiProperty({ description: 'Phone__c', nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ description: 'Mobile_Phone__c', nullable: true, type: String })
  mobilePhone: string | null;

  @ApiProperty({ description: 'Picture__c', nullable: true, type: String, format: 'uri' })
  picture: string | null;

  @ApiProperty({ description: 'CreatedDate', format: 'date-time' })
  createdAt: string;

  @ApiProperty({ description: 'LastModifiedDate', format: 'date-time' })
  updatedAt: string;
}

/** Body of POST /brokers (the Broker__c "New" record form, validated server-side). */
export class CreateBrokerDto {
  @ApiProperty({ description: 'Broker__c.Name (required)', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(BROKER_LIMITS.name)
  name: string;

  @ApiPropertyOptional({
    description: 'Broker_Id__c (Number 18,0) as a digit string',
    pattern: BROKER_ID.source,
  })
  @IsOptional()
  @IsString()
  @Matches(BROKER_ID, { message: 'brokerId must be a whole number of at most 18 digits' })
  brokerId?: string | null;

  @ApiPropertyOptional({ description: 'Title__c', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(BROKER_LIMITS.title)
  title?: string | null;

  @ApiPropertyOptional({ description: 'Email__c', format: 'email', maxLength: 80 })
  @IsOptional()
  @IsEmail()
  @MaxLength(BROKER_LIMITS.email)
  email?: string | null;

  @ApiPropertyOptional({ description: 'Phone__c', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(BROKER_LIMITS.phone)
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Mobile_Phone__c', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(BROKER_LIMITS.mobilePhone)
  mobilePhone?: string | null;

  @ApiPropertyOptional({ description: 'Picture__c', format: 'uri', maxLength: 255 })
  @IsOptional()
  @IsUrl()
  @MaxLength(BROKER_LIMITS.picture)
  picture?: string | null;
}

/** Body of PATCH /brokers/{id}: any subset; `null` clears an optional field, `name` cannot be cleared. */
export class UpdateBrokerDto extends PartialType(OmitType(CreateBrokerDto, ['name'] as const)) {
  @ApiPropertyOptional({ description: 'Broker__c.Name', maxLength: 80 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(BROKER_LIMITS.name)
  name?: string;
}
