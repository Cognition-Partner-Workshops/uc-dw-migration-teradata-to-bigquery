import { describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../../config/app-config.service';
import { GeocodingService, firstCoordinates, toSearchParams } from './geocoding.service';
import { NominatimClient, NominatimError, NominatimPlace } from './nominatim.client';

// Same fixture as GeocodingServiceTest.cls
const STREET = 'Calle Real';
const CITY = 'Armilla';
const STATE = 'Granada';
const COUNTRY = 'Spain';
const POSTAL_CODE = '18100';

function configWith(overrides: Record<string, unknown> = {}): AppConfigService {
  const values: Record<string, unknown> = {
    GEOCODING_CACHE_TTL_SECONDS: 3600,
    GEOCODING_CACHE_MAX_ENTRIES: 2,
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as AppConfigService;
}

function makeService(search: (params: unknown) => Promise<NominatimPlace[]>, overrides = {}) {
  const client = { search: vi.fn(search), baseUrl: 'https://nominatim.test/search?format=json' };
  const service = new GeocodingService(client as unknown as NominatimClient, configWith(overrides));
  return { service, client };
}

describe('GeocodingService (port of GeocodingServiceTest)', () => {
  it('successResponse: returns the first result as Coordinates and queries every non-blank field', async () => {
    const { service, client } = makeService(async () => [{ lat: '3.123', lon: '31.333' }]);

    const results = await service.geocodeAddresses([
      { street: STREET, city: CITY, state: STATE, country: COUNTRY, postalcode: POSTAL_CODE },
    ]);

    expect(results).toEqual([{ lat: 3.123, lon: 31.333 }]);
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(client.search).toHaveBeenCalledWith({
      street: STREET,
      city: CITY,
      state: STATE,
      country: COUNTRY,
      postalcode: POSTAL_CODE,
    });
  });

  it('blankAddress: makes no callout and returns null coordinates', async () => {
    const { service, client } = makeService(async () => []);

    const results = await service.geocodeAddresses([{ street: '  ', city: '' }, {}]);

    expect(results).toEqual([
      { lat: null, lon: null },
      { lat: null, lon: null },
    ]);
    expect(client.search).not.toHaveBeenCalled();
  });

  it('errorResponse: an upstream failure yields null coordinates (HTTP 200 for the caller)', async () => {
    const { service, client } = makeService(async () => {
      throw new NominatimError('HTTP 400', 400);
    });

    const results = await service.geocodeAddresses([{ city: CITY }]);

    expect(results).toEqual([{ lat: null, lon: null }]);
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(service.cacheSize).toBe(0);
  });

  it('returns one entry per input, in order', async () => {
    const { service } = makeService(async (params) =>
      (params as { city: string }).city === 'A' ? [{ lat: 1, lon: 1 }] : [],
    );

    const results = await service.geocodeAddresses([{ city: 'A' }, {}, { city: 'B' }]);

    expect(results).toEqual([
      { lat: 1, lon: 1 },
      { lat: null, lon: null },
      { lat: null, lon: null },
    ]);
  });

  it('caches successful lookups (case-insensitive) and does not cache failures', async () => {
    let fail = false;
    const { service, client } = makeService(async () => {
      if (fail) throw new NominatimError('HTTP 503', 503);
      return [{ lat: 1, lon: 2 }];
    });

    await service.geocodeAddress({ city: CITY, country: COUNTRY });
    await service.geocodeAddress({ city: CITY.toUpperCase(), country: ` ${COUNTRY} ` });
    expect(client.search).toHaveBeenCalledTimes(1);

    fail = true;
    expect(await service.geocodeAddress({ city: 'Elsewhere' })).toEqual({ lat: null, lon: null });
    expect(await service.geocodeAddress({ city: 'Elsewhere' })).toEqual({ lat: null, lon: null });
    expect(client.search).toHaveBeenCalledTimes(3);
  });

  it('evicts the oldest entries beyond GEOCODING_CACHE_MAX_ENTRIES', async () => {
    const { service, client } = makeService(async () => [{ lat: 1, lon: 2 }]);

    await service.geocodeAddress({ city: 'one' });
    await service.geocodeAddress({ city: 'two' });
    await service.geocodeAddress({ city: 'three' });
    expect(service.cacheSize).toBe(2);

    await service.geocodeAddress({ city: 'one' });
    expect(client.search).toHaveBeenCalledTimes(4);
  });

  it('expires cache entries after the TTL', async () => {
    vi.useFakeTimers();
    try {
      const { service, client } = makeService(async () => [{ lat: 1, lon: 2 }], {
        GEOCODING_CACHE_TTL_SECONDS: 10,
      });
      await service.geocodeAddress({ city: 'one' });
      vi.advanceTimersByTime(11_000);
      await service.geocodeAddress({ city: 'one' });
      expect(client.search).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('disables the cache when GEOCODING_CACHE_TTL_SECONDS is 0', async () => {
    const { service, client } = makeService(async () => [{ lat: 1, lon: 2 }], {
      GEOCODING_CACHE_TTL_SECONDS: 0,
    });
    await service.geocodeAddress({ city: 'one' });
    await service.geocodeAddress({ city: 'one' });
    expect(client.search).toHaveBeenCalledTimes(2);
    expect(service.cacheSize).toBe(0);
  });
});

describe('toSearchParams', () => {
  it('mirrors String.isNotBlank and trims values', () => {
    expect(toSearchParams({ street: ' x ', city: '   ', state: undefined })).toEqual({
      street: 'x',
    });
    expect(toSearchParams({})).toBeNull();
  });
});

describe('firstCoordinates', () => {
  it('parses string and numeric lat/lon from the first result', () => {
    expect(
      firstCoordinates([
        { lat: '3.123', lon: '31.333' },
        { lat: 0, lon: 0 },
      ]),
    ).toEqual({
      lat: 3.123,
      lon: 31.333,
    });
    expect(firstCoordinates([{ lat: 1, lon: 2 }])).toEqual({ lat: 1, lon: 2 });
  });

  it('maps no match or unparsable values to null coordinates', () => {
    expect(firstCoordinates([])).toEqual({ lat: null, lon: null });
    expect(firstCoordinates([{ lat: 'n/a', lon: '1' }])).toEqual({ lat: null, lon: null });
  });
});
