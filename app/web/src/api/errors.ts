import type { ApiErrorDto, FieldErrorDto } from './types';

/**
 * A 4xx/5xx answer of a record write (`ApiErrorDto`), shaped like the error LDS `createRecord` /
 * `updateRecord` rejected with: `body.output.fieldErrors` keyed by API field name and
 * `body.output.errors` for the record-level failures. `pageErrors` / `fieldErrors` mirror the
 * `ldsUtils.reduceErrors` branches so an `ErrorPanel` lists every message like Lightning did.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: Partial<ApiErrorDto> | undefined;
  readonly pageErrors: { message: string }[];
  readonly fieldErrors: Record<string, FieldErrorDto[]>;

  constructor(status: number, body: unknown, fallbackMessage: string) {
    const dto = isApiErrorBody(body) ? body : undefined;
    super(messageOf(dto) ?? fallbackMessage);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = dto;
    this.pageErrors = dto?.output?.errors ?? [];
    this.fieldErrors = dto?.output?.fieldErrors ?? {};
  }

  /** First message per field, for `lightning-input` style inline errors. */
  get fieldMessages(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(this.fieldErrors)
        .filter(([, errors]) => errors.length > 0)
        .map(([field, errors]) => [field, errors[0].message]),
    );
  }

  /** The messages that are not tied to one field (shown at the top of the form). */
  get recordMessages(): string[] {
    if (this.pageErrors.length > 0) {
      return this.pageErrors.map((error) => error.message);
    }
    return Object.keys(this.fieldErrors).length > 0 ? [] : [this.message];
  }
}

function isApiErrorBody(body: unknown): body is Partial<ApiErrorDto> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

function messageOf(body: Partial<ApiErrorDto> | undefined): string | undefined {
  const message = (body as { message?: unknown } | undefined)?.message;
  if (Array.isArray(message)) {
    return message.map(String).join(', ');
  }
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

/** Turns an openapi-fetch `{ response, error }` failure into an `ApiRequestError`. */
export function toApiRequestError(response: Response, error: unknown, action: string) {
  return new ApiRequestError(response.status, error, `${action} failed (${response.status})`);
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}
