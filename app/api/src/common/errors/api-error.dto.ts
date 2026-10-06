import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

/**
 * Error vocabulary shared by every write endpoint. The codes are the Salesforce
 * `StatusCode` names the Lightning UI (lightning-record-form / LDS `createRecord`)
 * surfaced for the same failures, so the React forms can keep the same copy.
 */
export const ERROR_CODES = {
  requiredFieldMissing: 'REQUIRED_FIELD_MISSING',
  stringTooLong: 'STRING_TOO_LONG',
  invalidType: 'INVALID_TYPE_ON_FIELD_IN_RECORD',
  fieldIntegrity: 'FIELD_INTEGRITY_EXCEPTION',
  restrictedPicklist: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST',
  invalidEmail: 'INVALID_EMAIL_ADDRESS',
  invalidId: 'INVALID_ID_FIELD',
  invalidCrossReference: 'INVALID_CROSS_REFERENCE_KEY',
  invalidField: 'INVALID_FIELD',
  duplicateValue: 'DUPLICATE_VALUE',
  geocodingFault: 'GEOCODING_FAULT',
  // auth (src/auth): no session / no object or class permission / field not editable for the caller
  invalidSession: 'INVALID_SESSION_ID',
  insufficientAccess: 'INSUFFICIENT_ACCESS_OR_READONLY',
  invalidFieldForInsertUpdate: 'INVALID_FIELD_FOR_INSERT_UPDATE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** One failed rule on one field (`output.fieldErrors.<field>[]` of a UI API DML error). */
export class FieldErrorDto {
  @ApiProperty({ description: 'API field name (camelCase)', example: 'beds' })
  field: string;

  @ApiProperty({
    description: 'Salesforce StatusCode name for the failed rule',
    enum: Object.values(ERROR_CODES),
    example: ERROR_CODES.fieldIntegrity,
  })
  errorCode: ErrorCode;

  @ApiProperty({ example: 'beds must not be greater than 99' })
  message: string;
}

/** A failure that is not tied to a single field (`output.errors[]`). */
export class RecordErrorDto {
  @ApiProperty({ enum: Object.values(ERROR_CODES), example: ERROR_CODES.geocodingFault })
  errorCode: ErrorCode;

  @ApiProperty()
  message: string;
}

@ApiExtraModels(FieldErrorDto)
export class ApiErrorOutputDto {
  @ApiProperty({ type: RecordErrorDto, isArray: true })
  errors: RecordErrorDto[];

  @ApiProperty({
    description: 'Field errors keyed by API field name',
    type: 'object',
    additionalProperties: { type: 'array', items: { $ref: getSchemaPath(FieldErrorDto) } },
    example: {
      beds: [
        {
          field: 'beds',
          errorCode: 'FIELD_INTEGRITY_EXCEPTION',
          message: 'beds must not be greater than 99',
        },
      ],
    },
  })
  fieldErrors: Record<string, FieldErrorDto[]>;
}

/**
 * Body of every 4xx/5xx this API raises for a record operation. `message` keeps the
 * Nest/`reduceErrors` contract (one string), `output` mirrors the Lightning UI API
 * error (`error.body.output.errors` / `error.body.output.fieldErrors`) that
 * lightning-record-form rendered inline, so the React forms show the same thing.
 */
export class ApiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: 'Validation failed: beds, name' })
  message: string;

  @ApiProperty({ type: ApiErrorOutputDto })
  output: ApiErrorOutputDto;
}

export type ValidationErrorDto = ApiErrorDto;
