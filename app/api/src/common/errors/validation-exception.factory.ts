import { ValidationError, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { ERROR_CODES, ErrorCode, FieldErrorDto } from './api-error.dto';
import { FieldErrorsException } from './field-errors.exception';

/** class-validator constraint name → Salesforce StatusCode the same failure produced in the org. */
const CONSTRAINT_CODES: Record<string, ErrorCode> = {
  isNotEmpty: ERROR_CODES.requiredFieldMissing,
  isDefined: ERROR_CODES.requiredFieldMissing,
  maxLength: ERROR_CODES.stringTooLong,
  isEnum: ERROR_CODES.restrictedPicklist,
  isIn: ERROR_CODES.restrictedPicklist,
  isEmail: ERROR_CODES.invalidEmail,
  isUuid: ERROR_CODES.invalidId,
  whitelistValidation: ERROR_CODES.invalidField,
  isString: ERROR_CODES.invalidType,
  isNumber: ERROR_CODES.invalidType,
  isInt: ERROR_CODES.invalidType,
  isBoolean: ERROR_CODES.invalidType,
  isArray: ERROR_CODES.invalidType,
  isCalendarDate: ERROR_CODES.invalidType,
};

export function errorCodeForConstraint(constraint: string): ErrorCode {
  return CONSTRAINT_CODES[constraint] ?? ERROR_CODES.fieldIntegrity;
}

export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldErrorDto[] {
  const flattened: FieldErrorDto[] = [];
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      flattened.push({ field, errorCode: errorCodeForConstraint(constraint), message });
    }
    if (error.children?.length) {
      flattened.push(...flattenValidationErrors(error.children, field));
    }
  }
  return flattened;
}

export const validationExceptionFactory: ValidationPipeOptions['exceptionFactory'] = (errors) =>
  new FieldErrorsException(flattenValidationErrors(errors));

/** The global pipe main.ts and the test apps install (`configureApp`). */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: false,
    exceptionFactory: validationExceptionFactory,
  });
}
