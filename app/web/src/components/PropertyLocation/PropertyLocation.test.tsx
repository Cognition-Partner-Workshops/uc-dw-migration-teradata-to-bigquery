import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { PROPERTY_FAR_AWAY } from '@/test/fixtures/records';
import { renderWithProviders } from '@/test/render';
import { PropertyLocation } from './PropertyLocation';
import { distanceInMiles } from './distance';

const BROWSER_LOCATION = { latitude: 42.361145, longitude: -71.057083 };
const EXPECTED_DISTANCE = 1444.43371701009;

function stubGeolocation(geolocation: Partial<Geolocation> | undefined) {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: geolocation,
  });
}

// Port of lwc/propertyLocation/__tests__/propertyLocation.test.js
describe('PropertyLocation (c-property-location)', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'geolocation');
  beforeEach(() => mockApi(() => jsonResponse(PROPERTY_FAR_AWAY)));
  afterEach(() => {
    vi.restoreAllMocks();
    if (original) Object.defineProperty(globalThis.navigator, 'geolocation', original);
    else stubGeolocation(undefined);
  });

  it('computes the Haversine distance in miles', () => {
    expect(
      distanceInMiles(BROWSER_LOCATION, {
        latitude: PROPERTY_FAR_AWAY.latitude!,
        longitude: PROPERTY_FAR_AWAY.longitude!,
      }),
    ).toBeCloseTo(EXPECTED_DISTANCE, 6);
  });

  it('renders an error panel when no location services are available', async () => {
    stubGeolocation(undefined);
    renderWithProviders(<PropertyLocation propertyId={PROPERTY_FAR_AWAY.id} />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('Error computing location.');
  });

  it('renders an error panel when getRecord returns an error', async () => {
    vi.restoreAllMocks();
    mockApi(() => jsonResponse({ statusCode: 500, message: 'boom' }, 500));
    stubGeolocation({
      getCurrentPosition: (success) => success({ coords: BROWSER_LOCATION } as GeolocationPosition),
    });
    renderWithProviders(<PropertyLocation propertyId={PROPERTY_FAR_AWAY.id} />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('Error computing location.');
  });

  it('renders coordinates and distance when browser location is available', async () => {
    stubGeolocation({
      getCurrentPosition: (success) => success({ coords: BROWSER_LOCATION } as GeolocationPosition),
    });
    renderWithProviders(<PropertyLocation propertyId={PROPERTY_FAR_AWAY.id} />);
    expect(await screen.findByTestId('property-location-latitude')).toHaveTextContent('42.361145');
    expect(screen.getByTestId('property-location-longitude')).toHaveTextContent('-71.057083');
    const distance = screen.getByTestId('property-location-distance');
    expect(Number(distance.getAttribute('data-value'))).toBeCloseTo(EXPECTED_DISTANCE, 6);
    expect(distance).toHaveTextContent('1,444.43');
  });

  it('renders an error panel when the device denies the location', async () => {
    stubGeolocation({
      getCurrentPosition: (_success, error) =>
        error?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError),
    });
    renderWithProviders(<PropertyLocation propertyId={PROPERTY_FAR_AWAY.id} />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('Error computing location.');
    expect(screen.queryByTestId('property-location-details')).not.toBeInTheDocument();
  });
});
