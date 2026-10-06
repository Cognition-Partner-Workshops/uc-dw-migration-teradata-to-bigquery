import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PropertyFilter, FILTER_CHANGE_DELAY } from './PropertyFilter';

// Port of lwc/propertyFilter/__tests__/propertyFilter.test.js: `publish(FILTERSCHANGEMC)` is the
// URL search params written by usePropertyFilters.
describe('PropertyFilter (c-property-filter)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const flushDebounce = () => act(() => vi.advanceTimersByTime(FILTER_CHANGE_DELAY));

  it('fires the change event on new search input', () => {
    const { router } = renderWithProviders(<PropertyFilter />);

    fireEvent.change(screen.getByLabelText('Search Key'), { target: { value: 'Boston' } });
    expect(router.state.location.search).toBe('');
    flushDebounce();

    expect(new URLSearchParams(router.state.location.search).get('searchKey')).toBe('Boston');
  });

  it('fires the change event on Max Price slider input', () => {
    const { router } = renderWithProviders(<PropertyFilter />);
    const slider = screen.getByRole('slider', { name: 'Max Price' });
    expect(slider).toHaveAttribute('aria-valuenow', '1200000');

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    flushDebounce();

    expect(new URLSearchParams(router.state.location.search).get('maxPrice')).toBe('1150000');
  });

  it('fires the change event on Bedrooms slider input', () => {
    const { router } = renderWithProviders(<PropertyFilter />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Bedrooms' }), { key: 'ArrowRight' });
    flushDebounce();

    expect(new URLSearchParams(router.state.location.search).get('minBedrooms')).toBe('1');
  });

  it('fires the change event on Bathrooms slider input', () => {
    const { router } = renderWithProviders(<PropertyFilter />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Bathrooms' }), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Bathrooms' }), { key: 'ArrowRight' });
    flushDebounce();

    expect(new URLSearchParams(router.state.location.search).get('minBathrooms')).toBe('2');
  });

  it('fires change event when reset button is clicked', () => {
    const { router } = renderWithProviders(<PropertyFilter />, {
      initialPath: '/?searchKey=Boston&maxPrice=500000&minBedrooms=2&minBathrooms=1',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(router.state.location.search).toBe('');
  });

  it('resets to default values when reset button is clicked', () => {
    renderWithProviders(<PropertyFilter />, {
      initialPath: '/?searchKey=Boston&maxPrice=500000&minBedrooms=2&minBathrooms=1',
    });
    expect(screen.getByLabelText('Search Key')).toHaveValue('Boston');
    expect(screen.getByRole('slider', { name: 'Max Price' })).toHaveAttribute(
      'aria-valuenow',
      '500000',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByLabelText('Search Key')).toHaveValue('');
    expect(screen.getByRole('slider', { name: 'Max Price' })).toHaveAttribute(
      'aria-valuenow',
      '1200000',
    );
    expect(screen.getByRole('slider', { name: 'Bedrooms' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('slider', { name: 'Bathrooms' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('keeps the other params (selected property) when publishing', () => {
    const { router } = renderWithProviders(<PropertyFilter />, { initialPath: '/?selected=abc' });

    fireEvent.change(screen.getByLabelText('Search Key'), { target: { value: 'Cam' } });
    flushDebounce();

    const params = new URLSearchParams(router.state.location.search);
    expect(params.get('selected')).toBe('abc');
    expect(params.get('searchKey')).toBe('Cam');
  });
});
