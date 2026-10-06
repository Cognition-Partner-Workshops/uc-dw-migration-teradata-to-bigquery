import { BadGatewayException, BadRequestException, HttpStatus } from '@nestjs/common';
import { ApiErrorDto, ERROR_CODES, FieldErrorDto, RecordErrorDto } from './api-error.dto';

export function groupFieldErrors(fieldErrors: FieldErrorDto[]): Record<string, FieldErrorDto[]> {
  const grouped: Record<string, FieldErrorDto[]> = {};
  for (const fieldError of fieldErrors) {
    (grouped[fieldError.field] ??= []).push(fieldError);
  }
  return grouped;
}

export function apiErrorBody(
  statusCode: number,
  error: string,
  message: string,
  fieldErrors: FieldErrorDto[] = [],
  errors: RecordErrorDto[] = [],
): ApiErrorDto {
  return {
    statusCode,
    error,
    message,
    output: { errors, fieldErrors: groupFieldErrors(fieldErrors) },
  };
}

/**
 * HTTP 400 carrying field-level errors: the API counterpart of the
 * `DmlException` / UI API `fieldErrors` the Lightning forms displayed.
 */
export class FieldErrorsException extends BadRequestException {
  constructor(fieldErrors: FieldErrorDto[], errors: RecordErrorDto[] = []) {
    const fields = [...new Set(fieldErrors.map((fieldError) => fieldError.field))];
    const message =
      fields.length > 0
        ? `Validation failed: ${fields.join(', ')}`
        : (errors[0]?.message ?? 'Validation failed');
    super(apiErrorBody(HttpStatus.BAD_REQUEST, 'Bad Request', message, fieldErrors, errors));
  }

  static forField(field: string, errorCode: FieldErrorDto['errorCode'], message: string) {
    return new FieldErrorsException([{ field, errorCode, message }]);
  }
}

/**
 * The `geocode_address` fault connector of the Create_property flow (Error5 screen:
 * "An error occurred while geocoding the address"): the record is not created.
 */
export class GeocodingFaultException extends BadGatewayException {
  constructor(cause: string) {
    const message = `Geocoding failed: ${cause}`;
    super(
      apiErrorBody(
        HttpStatus.BAD_GATEWAY,
        'Bad Gateway',
        message,
        [],
        [{ errorCode: ERROR_CODES.geocodingFault, message }],
      ),
    );
  }
}
