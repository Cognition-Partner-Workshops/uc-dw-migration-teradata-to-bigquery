import { describe, expect, it, vi } from 'vitest';
import { FetchLike, NominatimClient, NominatimError } from './nominatim.client';

const BASE_URL = 'https://nominatim.test/search?format=json';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function makeClient(
  fetch: FetchLike,
  overrides: Partial<ConstructorParameters<typeof NominatimClient>[0]> = {},
) {
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
  const client = new NominatimClient({
    baseUrl: BASE_URL,
    userAgent: 'dreamhouse-api-test',
    referer: 'https://dreamhouse.test',
    timeoutMs: 50,
    maxRetries: 2,
    minIntervalMs: 0,
    retryBackoffMs: 10,
    fetch,
    sleep,
    ...overrides,
  });
  return { client, sleep };
}

describe('NominatimClient', () => {
  it('builds the Apex query: base URL + one parameter per non-blank field', () => {
    const { client } = makeClient(vi.fn());
    const url = new URL(
      client.buildSearchUrl({ street: 'Calle Real', city: 'Armilla', state: '', country: 'Spain' }),
    );
    expect(url.origin + url.pathname).toBe('https://nominatim.test/search');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('street')).toBe('Calle Real');
    expect(url.searchParams.get('city')).toBe('Armilla');
    expect(url.searchParams.get('country')).toBe('Spain');
    expect(url.searchParams.has('state')).toBe(false);
    expect(url.searchParams.has('postalcode')).toBe(false);
  });

  it('sends User-Agent and Referer headers and parses the result list', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse([{ lat: '3.123', lon: '31.333' }]));
    const { client } = makeClient(fetch);

    const places = await client.search({ city: 'Armilla' });

    expect(places).toEqual([{ lat: '3.123', lon: '31.333' }]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({
      'user-agent': 'dreamhouse-api-test',
      referer: 'https://dreamhouse.test',
    });
  });

  it('does not retry a 400 and reports the status', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ error: 'bad' }, 400));
    const { client, sleep } = makeClient(fetch);

    await expect(client.search({ city: 'x' })).rejects.toMatchObject({
      name: 'NominatimError',
      status: 400,
      attempts: 1,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries 5xx / 429 with back-off (Retry-After honoured) up to maxRetries, then succeeds', async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse('oops', 503))
      .mockResolvedValueOnce(jsonResponse('slow down', 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(jsonResponse([{ lat: 1, lon: 2 }]));
    const { client, sleep } = makeClient(fetch);

    await expect(client.search({ city: 'x' })).resolves.toEqual([{ lat: 1, lon: 2 }]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([10, 2000]);
  });

  it('gives up after maxRetries + 1 attempts', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse('down', 502));
    const { client } = makeClient(fetch, { maxRetries: 1 });

    const error = await client.search({ city: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NominatimError);
    expect((error as NominatimError).attempts).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('aborts a request that exceeds the timeout and retries it', async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockImplementationOnce(
        (_url, init) =>
          new Promise<Response>((_, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            ),
          ),
      )
      .mockResolvedValueOnce(jsonResponse([{ lat: 1, lon: 2 }]));
    const { client } = makeClient(fetch, { timeoutMs: 20 });

    await expect(client.search({ city: 'x' })).resolves.toEqual([{ lat: 1, lon: 2 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries network errors and surfaces the last message', async () => {
    const fetch = vi.fn<FetchLike>(async () => {
      throw new Error('ECONNRESET');
    });
    const { client } = makeClient(fetch, { maxRetries: 1 });

    await expect(client.search({ city: 'x' })).rejects.toMatchObject({
      message: 'ECONNRESET',
      status: undefined,
      attempts: 2,
    });
  });

  it('spaces consecutive requests by minIntervalMs (Nominatim 1 req/s)', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse([]));
    const { client, sleep } = makeClient(fetch, { minIntervalMs: 1000 });

    await Promise.all([client.search({ city: 'a' }), client.search({ city: 'b' })]);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    const [waited] = sleep.mock.calls[0];
    expect(waited).toBeGreaterThan(900);
    expect(waited).toBeLessThanOrEqual(1000);
  });

  it('treats a non-array 200 body as a non-retriable failure', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ unexpected: true }));
    const { client } = makeClient(fetch);

    await expect(client.search({ city: 'x' })).rejects.toMatchObject({
      message: 'unexpected body',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
