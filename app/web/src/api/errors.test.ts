import { describe, expect, it } from 'vitest';
import { ApiRequestError, toApiRequestError } from './errors';

describe('ApiRequestError', () => {
  it('maps output.fieldErrors to one message per field and keeps record errors apart', () => {
    const error = new ApiRequestError(
      400,
      {
        statusCode: 400,
        message: 'Validation failed',
        output: {
          errors: [{ message: 'Broker does not exist' }],
          fieldErrors: {
            price: [{ field: 'price', errorCode: 'MIN', message: 'price must not be less than 0' }],
            name: [],
          },
        },
      },
      'Saving failed',
    );
    expect(error.message).toBe('Validation failed');
    expect(error.fieldMessages).toEqual({ price: 'price must not be less than 0' });
    expect(error.recordMessages).toEqual(['Broker does not exist']);
  });

  it('falls back to the status message when the body is not an ApiErrorDto', () => {
    const error = toApiRequestError(new Response(null, { status: 502 }), 'Bad gateway', 'Saving');
    expect(error.message).toBe('Saving failed (502)');
    expect(error.fieldMessages).toEqual({});
    expect(error.recordMessages).toEqual(['Saving failed (502)']);
  });

  it('shows no record message when only field errors came back (the fields carry them)', () => {
    const error = new ApiRequestError(
      400,
      {
        message: ['beds must be an integer'],
        output: {
          fieldErrors: { beds: [{ field: 'beds', errorCode: 'X', message: 'must be an integer' }] },
        },
      },
      'Saving failed',
    );
    expect(error.recordMessages).toEqual([]);
    expect(error.message).toBe('beds must be an integer');
  });
});
