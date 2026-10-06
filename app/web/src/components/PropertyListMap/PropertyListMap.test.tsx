import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapMarker } from '@/components/MapView/MapView';
import { clearRememberedProperties } from '@/state/selectedProperty';
import { jsonResponse, mockApi } from '@/test/api-mock';
import pagedProperties from '@/test/fixtures/pagedProperties.json';
import { renderWithProviders } from '@/test/render';
import { PropertyListMap } from './PropertyListMap';

// Leaflet needs a real layout engine; like the LWC suite mocks `L`, the map is replaced by a
// stub that exposes its markers and click handler.
vi.mock('@/components/MapView/MapView', () => ({
  MapView: ({
    markers,
    onMarkerClick,
    'data-testid': testId,
  }: {
    markers: MapMarker[];
    onMarkerClick?: (id: string) => void;
    'data-testid'?: string;
  }) => (
    <div data-testid={testId ?? 'map-view'} data-marker-count={markers.length}>
      {markers.map((marker) => (
        <button
          type="button"
          key={marker.id}
          data-testid="map-marker"
          data-position={JSON.stringify(marker.position)}
          onClick={() => onMarkerClick?.(marker.id)}
        >
          {marker.tooltip}
        </button>
      ))}
    </div>
  ),
}));

const notificationsShow = vi.fn();
vi.mock('@mantine/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/notifications')>();
  return {
    ...actual,
    notifications: {
      ...actual.notifications,
      show: (...args: unknown[]) => notificationsShow(...args),
    },
  };
});

// Port of lwc/propertyListMap/__tests__/propertyListMap.test.js
describe('PropertyListMap (c-property-list-map)', () => {
  beforeEach(() => {
    clearRememberedProperties();
    notificationsShow.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers propertyFilters subscriber during the component lifecycle', async () => {
    const { requests } = mockApi(() => jsonResponse(pagedProperties));
    renderWithProviders(<PropertyListMap />, {
      initialPath: '/?searchKey=Boston&maxPrice=900000&minBedrooms=2&minBathrooms=1',
    });

    await screen.findAllByTestId('map-marker');
    expect(Object.fromEntries(requests()[0].searchParams)).toEqual({
      searchKey: 'Boston',
      maxPrice: '900000',
      minBedrooms: '2',
      minBathrooms: '1',
    });
  });

  it('loads the leaflet map', async () => {
    mockApi(() => jsonResponse(pagedProperties));
    renderWithProviders(<PropertyListMap />);

    expect(await screen.findByTestId('property-list-map-view')).toBeInTheDocument();
  });

  it('fires a toast event when properties cannot be retrieved', async () => {
    mockApi(() => jsonResponse({ statusCode: 500, message: 'Internal server error' }, 500));
    renderWithProviders(<PropertyListMap />);

    await waitFor(() => expect(notificationsShow).toHaveBeenCalledTimes(1));
    expect(notificationsShow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error loading properties',
        message: 'Loading properties failed (500)',
        color: 'red',
      }),
    );
    expect(screen.getByTestId('property-list-map-view')).toHaveAttribute('data-marker-count', '0');
  });

  it('updates map when properties are received', async () => {
    mockApi(() => jsonResponse(pagedProperties));
    renderWithProviders(<PropertyListMap />);

    const markers = await screen.findAllByTestId('map-marker');
    expect(markers).toHaveLength(pagedProperties.records.length);
    const first = pagedProperties.records[0];
    expect(markers[0]).toHaveAttribute(
      'data-position',
      JSON.stringify([first.latitude, first.longitude]),
    );
    expect(markers[0]).toHaveTextContent(first.name);
    expect(markers[0]).toHaveTextContent(`Beds: ${first.beds} - Baths: ${first.baths}`);
  });

  it('publishes PropertySelected when a marker is clicked', async () => {
    const user = userEvent.setup();
    mockApi(() => jsonResponse(pagedProperties));
    const { router } = renderWithProviders(<PropertyListMap />);

    const markers = await screen.findAllByTestId('map-marker');
    await user.click(markers[2]);

    expect(new URLSearchParams(router.state.location.search).get('selected')).toBe(
      pagedProperties.records[2].id,
    );
  });
});
