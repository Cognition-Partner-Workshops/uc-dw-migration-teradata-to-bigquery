/**
 * Characterisation of salesforce/force-app/main/default/classes/GeocodingServiceTest.cls
 * (source: GeocodingService.cls) against POST /geocoding/addresses.
 *
 * Apex `Test.setMock(HttpCalloutMock)` becomes an MSW handler for Nominatim
 * (tests/parity/mocks/nominatim.ts). Goes green with plan step s4.3 / UNT3-17.
 */
import { afterAll, afterEach, beforeAll, describe, expect } from 'vitest';
import { useApiTestContext } from './harness/api-test-context';
import { characterise } from './harness/characterise';
import { standardUser, asUser } from '../fixtures/users';
import {
  createGeocodingMockServer,
  nominatimError,
  nominatimSuccess,
  unhandledRequestPolicy,
} from '../mocks/nominatim';

const { spec } = characterise('GeocodingServiceTest', 'UNT3-17');
const ctx = useApiTestContext();
const nominatim = createGeocodingMockServer();

// GeocodingServiceTest.cls lines 3-9: STREET, CITY, POSTAL_CODE, STATE, COUNTRY, LATITUDE, LONGITUDE.
const STREET = 'Camino del Jueves 26';
const CITY = 'Armilla';
const POSTAL_CODE = '18100';
const STATE = 'Granada';
const COUNTRY = 'Spain';
const LATITUDE = 3.123;
const LONGITUDE = 31.333;

beforeAll(() => nominatim.listen(unhandledRequestPolicy));
afterEach(() => nominatim.resetHandlers());
afterAll(() => nominatim.close());

async function geocodeAddresses(addresses: object[]) {
  // GeocodingService.geocodeAddresses(List<GeocodingAddress>) → POST /geocoding/addresses { addresses }.
  return ctx.api().post('/geocoding/addresses').set(asUser(standardUser)).send({ addresses });
}

describe('GeocodingServiceTest', () => {
  spec('successResponse', async () => {
    // GIVEN — GeocodingServiceTest.successResponse lines 14-19: a fully populated address.
    const address = {
      street: STREET,
      city: CITY,
      postalcode: POSTAL_CODE,
      state: STATE,
      country: COUNTRY,
    };
    // lines 21-24: Test.setMock(HttpCalloutMock.class, new OpenStreetMapHttpCalloutMockImpl()).
    const mock = nominatimSuccess(LATITUDE, LONGITUDE);
    nominatim.use(mock.handler);

    // WHEN — lines 27-29.
    const response = await geocodeAddresses([address]);
    expect(response.status).toBe(200);
    const computedCoordinates = response.body as { lat: number | null; lon: number | null }[];

    // THEN — line 32: Assert.areEqual(1, computedCoordinates.size()).
    expect(computedCoordinates).toHaveLength(1);
    // line 33: Assert.areEqual(LATITUDE, computedCoordinates[0].lat).
    expect(computedCoordinates[0].lat).toBe(LATITUDE);
    // line 34: Assert.areEqual(LONGITUDE, computedCoordinates[0].lon).
    expect(computedCoordinates[0].lon).toBe(LONGITUDE);

    // GeocodingService.cls lines 11-26, 32: one GET with every non-blank field as a query parameter.
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].searchParams.get('format')).toBe('json');
    expect(mock.calls[0].searchParams.get('street')).toBe(STREET);
    expect(mock.calls[0].searchParams.get('city')).toBe(CITY);
    expect(mock.calls[0].searchParams.get('state')).toBe(STATE);
    expect(mock.calls[0].searchParams.get('country')).toBe(COUNTRY);
    expect(mock.calls[0].searchParams.get('postalcode')).toBe(POSTAL_CODE);
  });

  spec('blankAddress', async () => {
    // GIVEN — GeocodingServiceTest.blankAddress line 39: an address with no fields set.
    const address = {};
    // lines 41-44: the success mock is registered but must never be hit.
    const mock = nominatimSuccess(LATITUDE, LONGITUDE);
    nominatim.use(mock.handler);

    // WHEN — lines 47-49.
    const response = await geocodeAddresses([address]);
    expect(response.status).toBe(200);
    const computedCoordinates = response.body as { lat: number | null; lon: number | null }[];

    // THEN — line 52: Assert.areEqual(1, computedCoordinates.size()).
    expect(computedCoordinates).toHaveLength(1);
    // line 53: Assert.isNull(computedCoordinates[0].lat).
    expect(computedCoordinates[0].lat).toBeNull();
    // line 54: Assert.isNull(computedCoordinates[0].lon).
    expect(computedCoordinates[0].lon).toBeNull();

    // GeocodingService.cls line 29: `if (geocodingUrl != BASE_URL)` — no callout for a blank address.
    expect(mock.calls).toHaveLength(0);
  });

  spec('errorResponse', async () => {
    // GIVEN — GeocodingServiceTest.errorResponse lines 59-64: a fully populated address.
    const address = {
      street: STREET,
      city: CITY,
      postalcode: POSTAL_CODE,
      state: STATE,
      country: COUNTRY,
    };
    // lines 66-69: Test.setMock(HttpCalloutMock.class, new OpenStreetMapHttpCalloutMockImplError()) → HTTP 400.
    const mock = nominatimError();
    nominatim.use(mock.handler);

    // WHEN — lines 72-74.
    const response = await geocodeAddresses([address]);
    // GeocodingService.cls lines 39-45: a non-200 upstream answer is swallowed, the call still succeeds.
    expect(response.status).toBe(200);
    const computedCoordinates = response.body as { lat: number | null; lon: number | null }[];

    // THEN — line 77: Assert.areEqual(1, computedCoordinates.size()).
    expect(computedCoordinates).toHaveLength(1);
    // line 78: Assert.isNull(computedCoordinates[0].lat).
    expect(computedCoordinates[0].lat).toBeNull();
    // line 79: Assert.isNull(computedCoordinates[0].lon).
    expect(computedCoordinates[0].lon).toBeNull();
    expect(mock.calls).toHaveLength(1);
  });
});
