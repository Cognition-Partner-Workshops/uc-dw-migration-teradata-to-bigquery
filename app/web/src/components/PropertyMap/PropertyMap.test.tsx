import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapMarker } from '@/components/MapView/MapView';
import { clearRememberedProperties, rememberProperties } from '@/state/selectedProperty';
import { PROPERTY } from '@/test/fixtures/property';
import { renderWithProviders } from '@/test/render';
import { PropertyMap, PROPERTY_MAP_ZOOM } from './PropertyMap';

vi.mock('@/components/MapView/MapView', () => ({
  MapView: ({
    markers,
    zoom,
    'data-testid': testId,
  }: {
    markers: MapMarker[];
    zoom: number;
    'data-testid'?: string;
  }) => (
    <div data-testid={testId ?? 'map-view'} data-zoom={zoom} data-marker-count={markers.length}>
      {markers.map((marker) => (
        <div
          key={marker.id}
          data-testid="map-marker"
          data-position={JSON.stringify(marker.position)}
        >
          {marker.label}
        </div>
      ))}
    </div>
  ),
}));

// Port of lwc/propertyMap/__tests__/propertyMap.test.js
describe('PropertyMap (c-property-map)', () => {
  beforeEach(() => {
    clearRememberedProperties();
  });

  it('renders an error panel when no property is selected', () => {
    renderWithProviders(<PropertyMap />);
    expect(screen.getByTestId('error-panel')).toHaveTextContent(
      'Select a property to see its location',
    );
  });

  it('renders a map when a property is selected', () => {
    rememberProperties([PROPERTY]);
    renderWithProviders(<PropertyMap />, { initialPath: `/?selected=${PROPERTY.id}` });

    expect(screen.getByTestId('property-map-address')).toHaveTextContent(
      `${PROPERTY.address}, ${PROPERTY.city}`,
    );
    const map = screen.getByTestId('property-map-view');
    expect(map).toHaveAttribute('data-zoom', String(PROPERTY_MAP_ZOOM));
    const marker = screen.getByTestId('map-marker');
    expect(marker).toHaveAttribute(
      'data-position',
      JSON.stringify([PROPERTY.latitude, PROPERTY.longitude]),
    );
    expect(marker).toHaveTextContent(PROPERTY.name);
    expect(marker).toHaveTextContent(`Address: ${PROPERTY.address}`);
    expect(screen.queryByTestId('error-panel')).toBeNull();
  });
});
