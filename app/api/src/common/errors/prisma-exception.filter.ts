import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client';
import { ERROR_CODES, FieldErrorDto } from './api-error.dto';
import { FieldErrorsException } from './field-errors.exception';

/** Postgres column → API field where the two differ (`Location__c` compound → latitude/longitude). */
const COLUMN_FIELDS: Record<string, string[]> = {
  location_latitude: ['latitude'],
  location_longitude: ['longitude'],
  location: ['latitude', 'longitude'],
};

const CHECK_MESSAGES: Record<string, string> = {
  location: 'latitude and longitude must be set together',
};

const camelCase = (column: string): string =>
  column.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());

export function fieldsForColumn(column: string): string[] {
  return COLUMN_FIELDS[column] ?? [camelCase(column)];
}

/** `properties_beds_check` → `beds`; `properties_broker_id_fkey` → `broker_id`. */
function columnOfConstraint(constraint: string, table: string | undefined, suffix: string): string {
  let column = constraint.endsWith(suffix) ? constraint.slice(0, -suffix.length) : constraint;
  if (table && column.startsWith(`${table}_`)) column = column.slice(table.length + 1);
  return column;
}

interface DriverCause {
  code?: string;
  originalCode?: string;
  originalMessage?: string;
  message?: string;
  constraint?: { index?: string; fields?: string[] };
}

function driverCause(error: Prisma.PrismaClientKnownRequestError): DriverCause | undefined {
  const meta = error.meta as { driverAdapterError?: { cause?: DriverCause } } | undefined;
  return meta?.driverAdapterError?.cause;
}

function tableOf(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const model = (error.meta as { modelName?: string } | undefined)?.modelName;
  if (!model) return undefined;
  const snake = model.replace(/([A-Z])/g, (char) => `_${char.toLowerCase()}`).replace(/^_/, '');
  return snake.endsWith('y') ? `${snake.slice(0, -1)}ies` : `${snake}s`;
}

/**
 * Turns the database's answer into the same `output.fieldErrors` the DTO layer
 * produces, so the UI needs one error shape whether a rule lives in class-validator
 * or in a CHECK / FOREIGN KEY constraint (app/api/prisma/migrations, hand-maintained part).
 */
export function translatePrismaError(error: unknown): HttpException | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  const table = tableOf(error);
  const model = (error.meta as { modelName?: string } | undefined)?.modelName ?? 'Record';
  const cause = driverCause(error);

  switch (error.code) {
    case 'P2025':
      return new NotFoundException(`${model} not found`);
    case 'P2003': {
      const constraint = cause?.constraint?.index ?? '';
      const column = columnOfConstraint(constraint, table, '_fkey');
      return new FieldErrorsException(
        fieldsForColumn(column).map((field) => ({
          field,
          errorCode: ERROR_CODES.invalidCrossReference,
          message: `${field} refers to a record that does not exist`,
        })),
      );
    }
    case 'P2002': {
      const target = (error.meta as { target?: string[] | string } | undefined)?.target;
      const columns = Array.isArray(target) ? target : target ? [target] : [];
      if (columns.length === 0) return new ConflictException(`${model} already exists`);
      return new FieldErrorsException(
        columns.flatMap((column) =>
          fieldsForColumn(column).map((field) => ({
            field,
            errorCode: ERROR_CODES.duplicateValue,
            message: `${field} must be unique`,
          })),
        ),
      );
    }
    case 'P2000': {
      const column = (error.meta as { column_name?: string } | undefined)?.column_name;
      const fieldErrors: FieldErrorDto[] = column
        ? fieldsForColumn(column).map((field) => ({
            field,
            errorCode: ERROR_CODES.stringTooLong,
            message: `${field} is too long`,
          }))
        : [];
      return new FieldErrorsException(fieldErrors, [
        { errorCode: ERROR_CODES.stringTooLong, message: 'A value is too long for its field' },
      ]);
    }
    default: {
      // CHECK constraint violations come through as the raw Postgres error (SQLSTATE 23514).
      const sqlState = cause?.code ?? cause?.originalCode;
      if (sqlState === '23514') {
        const text = cause?.originalMessage ?? cause?.message ?? error.message;
        const constraint = /violates check constraint "([^"]+)"/.exec(text)?.[1] ?? '';
        const column = columnOfConstraint(constraint, table, '_check');
        return new FieldErrorsException(
          fieldsForColumn(column).map((field) => ({
            field,
            errorCode: ERROR_CODES.fieldIntegrity,
            message: CHECK_MESSAGES[column] ?? `${field} is out of range`,
          })),
        );
      }
      return undefined;
    }
  }
}

/** Global filter installed by `configureApp`; anything it cannot translate stays a 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const exception = translatePrismaError(error) ?? new InternalServerErrorException();
    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.reply(
      host.switchToHttp().getResponse(),
      exception.getResponse(),
      exception.getStatus(),
    );
  }
}
