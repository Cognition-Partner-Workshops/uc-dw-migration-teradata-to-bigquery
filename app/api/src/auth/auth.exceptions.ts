import { ForbiddenException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES, FieldErrorDto } from '../common/errors/api-error.dto';
import { apiErrorBody } from '../common/errors/field-errors.exception';

/** 401: no usable session — Salesforce `INVALID_SESSION_ID`. */
export class InvalidSessionException extends UnauthorizedException {
  constructor(message = 'Missing or invalid bearer token') {
    super(
      apiErrorBody(
        HttpStatus.UNAUTHORIZED,
        'Unauthorized',
        message,
        [],
        [{ errorCode: ERROR_CODES.invalidSession, message }],
      ),
    );
  }
}

export interface InsufficientAccessDetails {
  /** Permission key that was required (`properties.create`). */
  permission?: string;
  /** Groups holding that permission. */
  requiredGroups?: readonly string[];
  object?: string;
  fieldErrors?: FieldErrorDto[];
}

/**
 * 403: the caller is signed in but lacks the object/field/class permission — Salesforce
 * `INSUFFICIENT_ACCESS_OR_READONLY` (DML) / "You don't have access to this Apex class" (Aura).
 */
export class InsufficientAccessException extends ForbiddenException {
  constructor(message: string, details: InsufficientAccessDetails = {}) {
    super({
      ...apiErrorBody(HttpStatus.FORBIDDEN, 'Forbidden', message, details.fieldErrors ?? [], [
        { errorCode: ERROR_CODES.insufficientAccess, message },
      ]),
      ...(details.permission ? { permission: details.permission } : {}),
      ...(details.requiredGroups ? { requiredGroups: [...details.requiredGroups] } : {}),
      ...(details.object ? { object: details.object } : {}),
    });
  }
}
