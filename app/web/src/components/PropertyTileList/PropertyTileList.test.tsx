import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRememberedProperties, getRememberedProperty } from '@/state/selectedProperty';
import { jsonResponse, mockApi } from '@/test/api-mock';
import pagedProperties from '@/test/fixtures/pagedProperties.json';
import { renderWithProviders } from '@/test/render';
import { PropertyTileList } from './PropertyTileList';

// Port of lwc/propertyTileList/__tests__/propertyTileList.test.js
describe('PropertyTileList (c-property-tile-list)', () => {
  beforeEach(() => {
    clearRememberedProperties();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /properties (@wire getPagedPropertyList)', () => {
    it('renders properties when data returned', async () => {
      mockApi(() => jsonResponse(pagedProperties));
      renderWithProviders(<PropertyTileList />);

      const tiles = await screen.findAllByTestId('property-tile');
      expect(tiles).toHaveLength(pagedProperties.records.length);
      expect(tiles[0]).toHaveAttribute('data-property-id', pagedProperties.records[0].id);
      expect(screen.getByTestId('paginator-info')).toHaveTextContent('12 items • page 1 of 2');
      expect(screen.queryByTestId('error-panel')).toBeNull();
    });

    it('renders error panel when error returned', async () => {
      mockApi(() => jsonResponse({ statusCode: 500, message: 'Internal server error' }, 500));
      renderWithProviders(<PropertyTileList />);

      const panel = await screen.findByTestId('error-panel');
      expect(panel).toHaveTextContent('Error retrieving data');
      expect(screen.queryByTestId('property-tile')).toBeNull();
    });
  });

  it('registers propertyFilters subscriber during the component lifecycle', async () => {
    // Subscribing to FiltersChange = reading the filter URL params; the default criteria are sent.
    const { requests } = mockApi(() => jsonResponse(pagedProperties));
    renderWithProviders(<PropertyTileList />);

    await screen.findAllByTestId('property-tile');
    const url = requests()[0];
    expect(url.pathname).toMatch(/\/properties$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      searchKey: '',
      maxPrice: '1200000',
      minBedrooms: '0',
      minBathrooms: '0',
      pageSize: '9',
      pageNumber: '1',
    });
  });

  it('invokes getPagedPropertyList with the propertyFilters message payload value', async () => {
    const { requests } = mockApi(() => jsonResponse(pagedProperties));
    renderWithProviders(<PropertyTileList />, {
      initialPath: '/?searchKey=victorian&maxPrice=400000&minBedrooms=4&minBathrooms=2',
    });

    await screen.findAllByTestId('property-tile');
    expect(Object.fromEntries(requests()[0].searchParams)).toEqual({
      searchKey: 'victorian',
      maxPrice: '400000',
      minBedrooms: '4',
      minBathrooms: '2',
      pageSize: '9',
      pageNumber: '1',
    });
  });

  it('sends propertySelected event when c-property-tile selected', async () => {
    const user = userEvent.setup();
    mockApi(() => jsonResponse(pagedProperties));
    const { router } = renderWithProviders(<PropertyTileList />);

    const tiles = await screen.findAllByTestId('property-tile');
    await user.click(tiles[0]);

    const selectedId = pagedProperties.records[0].id;
    expect(new URLSearchParams(router.state.location.search).get('selected')).toBe(selectedId);
    // The shared store now carries the record for PropertySummary / PropertyMap.
    expect(getRememberedProperty(selectedId)?.name).toBe(pagedProperties.records[0].name);
  });

  it('pages with the paginator and goes back to page 1 when the filters change', async () => {
    const user = userEvent.setup();
    const { requests } = mockApi((url) =>
      jsonResponse({
        ...pagedProperties,
        pageNumber: Number(url.searchParams.get('pageNumber')),
        records:
          url.searchParams.get('pageNumber') === '2'
            ? pagedProperties.records.slice(0, 3)
            : pagedProperties.records,
      }),
    );
    const { router } = renderWithProviders(<PropertyTileList />);

    await screen.findAllByTestId('property-tile');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(screen.getByTestId('paginator-info')).toHaveTextContent('12 items • page 2 of 2'),
    );
    expect(await screen.findAllByTestId('property-tile')).toHaveLength(3);
    expect(requests().at(-1)?.searchParams.get('pageNumber')).toBe('2');

    await router.navigate('/?minBedrooms=3', { replace: true });
    await waitFor(() =>
      expect(screen.getByTestId('paginator-info')).toHaveTextContent('12 items • page 1 of 2'),
    );
    expect(requests().at(-1)?.searchParams.get('pageNumber')).toBe('1');
    expect(requests().at(-1)?.searchParams.get('minBedrooms')).toBe('3');
  });
});
