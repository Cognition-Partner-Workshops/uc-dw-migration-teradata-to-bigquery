import { describe, expect, it } from 'vitest';
import { NominatimClient } from './nominatim.client';

/**
 * Live smoke test against the real Nominatim endpoint — opt in with `GEOCODING_LIVE_SMOKE=1`
 * (`GEOCODING_LIVE_SMOKE=1 npm test -- geocoding.live`). Skipped by default so the suite stays
 * hermetic and within Nominatim's usage policy; one request, same fixture as GeocodingServiceTest.
 */
const liveEnabled = process.env.GEOCODING_LIVE_SMOKE === '1';

describe.skipIf(!liveEnabled)('GeocodingService live smoke (Nominatim)', () => {
  it('geocodes Calle Real, Armilla, Granada, Spain to somewhere in Andalusia', async () => {
    const client = new NominatimClient({
      baseUrl:
        process.env.GEOCODING_BASE_URL ?? 'https://nominatim.openstreetmap.org/search?format=json',
      userAgent: process.env.GEOCODING_USER_AGENT ?? 'dreamhouse-api live smoke test (CI)',
      timeoutMs: 15_000,
      maxRetries: 1,
      minIntervalMs: 1000,
    });

    const places = await client.search({
      street: 'Calle Real',
      city: 'Armilla',
      state: 'Granada',
      country: 'Spain',
      postalcode: '18100',
    });

    expect(places.length).toBeGreaterThan(0);
    const lat = Number(places[0].lat);
    const lon = Number(places[0].lon);
    expect(lat).toBeGreaterThan(36.5);
    expect(lat).toBeLessThan(37.5);
    expect(lon).toBeGreaterThan(-4.2);
    expect(lon).toBeLessThan(-3.2);
  }, 30_000);
});
