/**
 * Port of `c/ldsUtils` `reduceErrors`: flattens one error or an array of errors (LDS / Apex / UI
 * API shapes, `Error` instances, `Response`-like objects) into a list of human-readable messages.
 */
export function reduceErrors(errors: unknown): string[] {
  const list = Array.isArray(errors) ? errors : [errors];

  return (
    list
      // Remove null/undefined items
      .filter((error) => !!error)
      // Extract an error message
      .map((error: unknown) => {
        const err = error as {
          body?: unknown;
          message?: unknown;
          statusText?: unknown;
        };
        // UI API read errors
        if (Array.isArray(err.body)) {
          return (err.body as { message?: unknown }[]).map((e) => e.message);
        }
        // Page level errors
        const pageErrors = (err as { pageErrors?: { message?: unknown }[] }).pageErrors;
        if (Array.isArray(pageErrors) && pageErrors.length > 0) {
          return pageErrors.map((e) => e.message);
        }
        // Field level errors
        const fieldErrors = (err as { fieldErrors?: Record<string, { message?: unknown }[]> })
          .fieldErrors;
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          return Object.values(fieldErrors).flatMap((list) => list.map((e) => e.message));
        }
        // UI API DML, Apex and network errors
        const body = err.body as { message?: unknown } | undefined;
        if (body && typeof body === 'object' && typeof body.message === 'string') {
          return body.message;
        }
        // JS errors
        if (typeof err.message === 'string') {
          return err.message;
        }
        // Unknown error shape so try HTTP status text
        return err.statusText;
      })
      // Flatten
      .flat()
      // Remove empty strings
      .filter((message): message is string => typeof message === 'string' && message.length > 0)
  );
}
