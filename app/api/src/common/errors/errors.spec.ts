import { HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client';
import { isCalendarDate } from '../validation/is-calendar-date';
import { FieldErrorsException, GeocodingFaultException } from './field-errors.exception';
import { translatePrismaError } from './prisma-exception.filter';
import { errorCodeForConstraint, flattenValidationErrors } from './validation-exception.factory';

function prismaError(code: string, meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('FieldErrorsException (Lightning UI API error shape)', () => {
  it('groups field errors under output.fieldErrors and lists the fields in message', () => {
    const exception = new FieldErrorsException([
      { field: 'beds', errorCode: 'FIELD_INTEGRITY_EXCEPTION', message: 'too many' },
      { field: 'beds', errorCode: 'INVALID_TYPE_ON_FIELD_IN_RECORD', message: 'not an int' },
      { field: 'name', errorCode: 'REQUIRED_FIELD_MISSING', message: 'required' },
    ]);
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed: beds, name',
      output: {
        errors: [],
        fieldErrors: {
          beds: [
            { field: 'beds', errorCode: 'FIELD_INTEGRITY_EXCEPTION', message: 'too many' },
            { field: 'beds', errorCode: 'INVALID_TYPE_ON_FIELD_IN_RECORD', message: 'not an int' },
          ],
          name: [{ field: 'name', errorCode: 'REQUIRED_FIELD_MISSING', message: 'required' }],
        },
      },
    });
  });

  it('GeocodingFaultException is a 502 with a record-level GEOCODING_FAULT error', () => {
    const exception = new GeocodingFaultException('boom');
    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toMatchObject({
      message: 'Geocoding failed: boom',
      output: { errors: [{ errorCode: 'GEOCODING_FAULT' }], fieldErrors: {} },
    });
  });
});

describe('validation exception factory', () => {
  it('maps class-validator constraints to the Salesforce StatusCode of the same failure', () => {
    expect(errorCodeForConstraint('isNotEmpty')).toBe('REQUIRED_FIELD_MISSING');
    expect(errorCodeForConstraint('maxLength')).toBe('STRING_TOO_LONG');
    expect(errorCodeForConstraint('isIn')).toBe('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST');
    expect(errorCodeForConstraint('isEmail')).toBe('INVALID_EMAIL_ADDRESS');
    expect(errorCodeForConstraint('isUuid')).toBe('INVALID_ID_FIELD');
    expect(errorCodeForConstraint('whitelistValidation')).toBe('INVALID_FIELD');
    expect(errorCodeForConstraint('isInt')).toBe('INVALID_TYPE_ON_FIELD_IN_RECORD');
    expect(errorCodeForConstraint('max')).toBe('FIELD_INTEGRITY_EXCEPTION');
    expect(errorCodeForConstraint('somethingElse')).toBe('FIELD_INTEGRITY_EXCEPTION');
  });

  it('flattens nested validation errors to dotted field paths', () => {
    const flattened = flattenValidationErrors([
      {
        property: 'addresses',
        children: [
          { property: '0', children: [{ property: 'street', constraints: { isString: 'bad' } }] },
        ],
      },
    ]);
    expect(flattened).toEqual([
      { field: 'addresses.0.street', errorCode: 'INVALID_TYPE_ON_FIELD_IN_RECORD', message: 'bad' },
    ]);
  });
});

describe('translatePrismaError (database rules → the same field errors)', () => {
  it('P2025 → 404 naming the model', () => {
    const exception = translatePrismaError(prismaError('P2025', { modelName: 'Broker' }));
    expect(exception).toBeInstanceOf(NotFoundException);
    expect(exception?.getResponse()).toMatchObject({ message: 'Broker not found' });
  });

  it('CHECK violation (SQLSTATE 23514) → FIELD_INTEGRITY_EXCEPTION on the column of the constraint', () => {
    const exception = translatePrismaError(
      prismaError('P2039', {
        modelName: 'Property',
        driverAdapterError: {
          cause: {
            code: '23514',
            originalMessage:
              'new row for relation "properties" violates check constraint "properties_price_check"',
          },
        },
      }),
    );
    expect(exception?.getResponse()).toMatchObject({
      output: { fieldErrors: { price: [{ errorCode: 'FIELD_INTEGRITY_EXCEPTION' }] } },
    });
  });

  it('P2002 unique violation → DUPLICATE_VALUE on the API field of the column', () => {
    const exception = translatePrismaError(
      prismaError('P2002', { modelName: 'Property', target: ['sf_id'] }),
    );
    expect(exception?.getResponse()).toMatchObject({
      output: { fieldErrors: { sfId: [{ errorCode: 'DUPLICATE_VALUE' }] } },
    });
  });

  it('leaves anything else (and non-Prisma errors) alone', () => {
    expect(translatePrismaError(new Error('x'))).toBeUndefined();
    expect(translatePrismaError(prismaError('P1001', {}))).toBeUndefined();
  });
});

describe('isCalendarDate', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    expect(isCalendarDate('2026-10-06')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-10-06T00:00:00Z')).toBe(false);
    expect(isCalendarDate(20261006)).toBe(false);
  });
});
