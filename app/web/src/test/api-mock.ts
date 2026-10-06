import { vi } from 'vitest';

export type ApiRoute = (url: URL, request: Request) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Replaces `fetch` with a router over the `Request` objects the openapi-fetch client issues; the
 * spy's calls expose the requested URLs (search params included) for assertions.
 */
export function mockApi(route: ApiRoute) {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return route(new URL(request.url), request);
  });
  return {
    spy,
    requests: () =>
      spy.mock.calls.map(
        ([input]) => new URL(input instanceof Request ? input.url : String(input)),
      ),
  };
}
