import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Apex `Test.setMock(HttpCalloutMock.class, …)` → MSW handlers for the
 * Nominatim search endpoint the API's GeocodingService calls
 * (GEOCODING_BASE_URL; GeocodingService.cls line 2 `BASE_URL`).
 */
const geocodingBaseUrl =
  process.env.GEOCODING_BASE_URL ?? 'https://nominatim.openstreetmap.org/search?format=json';
export const NOMINATIM_SEARCH_URL = (() => {
  const url = new URL(geocodingBaseUrl);
  url.search = '';
  return url.toString();
})();

export interface NominatimMock {
  handler: HttpHandler;
  /** Every intercepted search URL, so specs can assert "no callout" cases. */
  calls: URL[];
}

function nominatimMock(respond: () => Response): NominatimMock {
  const calls: URL[] = [];
  const handler = http.get(NOMINATIM_SEARCH_URL, ({ request }) => {
    calls.push(new URL(request.url));
    return respond();
  });
  return { handler, calls };
}

/** GeocodingServiceTest.OpenStreetMapHttpCalloutMockImpl lines 82-90: 200 `[{"lat": 3.123,"lon": 31.333}]`. */
export function nominatimSuccess(lat = 3.123, lon = 31.333): NominatimMock {
  return nominatimMock(() => HttpResponse.json([{ lat, lon }], { status: 200 }));
}

/** GeocodingServiceTest.OpenStreetMapHttpCalloutErrorMockImpl lines 92-99: 400 with an empty JSON body. */
export function nominatimError(): NominatimMock {
  return nominatimMock(
    () => new HttpResponse('', { status: 400, headers: { 'Content-Type': 'application/json' } }),
  );
}

/**
 * Only Nominatim is mocked; supertest requests to the in-process API and
 * Prisma traffic must pass through untouched.
 */
export function createGeocodingMockServer() {
  return setupServer();
}

export const unhandledRequestPolicy = {
  onUnhandledRequest: 'bypass' as const,
};
