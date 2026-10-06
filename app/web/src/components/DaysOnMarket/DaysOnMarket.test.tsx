import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { PROPERTY_RECORD, daysAgo } from '@/test/fixtures/records';
import { renderWithProviders } from '@/test/render';
import { DaysOnMarket } from './DaysOnMarket';
import { daysOnMarketStatus } from './daysOnMarketStatus';

// Port of lwc/daysOnMarket/__tests__/daysOnMarket.test.js
describe('DaysOnMarket (c-days-on-market)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders error if no property is selected', () => {
    renderWithProviders(<DaysOnMarket />);
    expect(screen.getByTestId('error-panel')).toHaveTextContent(
      'Select a property to see days on the market',
    );
  });

  it('invokes getRecord with the published message payload value (selected URL param)', async () => {
    const { requests } = mockApi(() =>
      jsonResponse({ ...PROPERTY_RECORD, dateListed: daysAgo(10) }),
    );
    renderWithProviders(<DaysOnMarket />, { initialPath: `/?selected=${PROPERTY_RECORD.id}` });
    expect(await screen.findByTestId('days-on-market-days')).toHaveTextContent('10');
    expect(requests()[0].pathname).toBe(`/api/properties/${PROPERTY_RECORD.id}`);
  });

  describe('renders the days on the market', () => {
    it.each([
      ['normal', 10],
      ['warning', 45],
      ['alert', 75],
    ])('in %s case', async (status, days) => {
      mockApi(() => jsonResponse({ ...PROPERTY_RECORD, dateListed: daysAgo(days) }));
      renderWithProviders(<DaysOnMarket recordId={PROPERTY_RECORD.id} />);
      const badge = await screen.findByTestId('days-on-market-badge');
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge.className).toContain(status);
      expect(screen.getByTestId('days-on-market-days')).toHaveTextContent(String(days));
      expect(screen.getByTestId('days-on-market-bar')).toHaveStyle({
        width: `${(days / 90) * 100}%`,
      });
      expect(screen.getByText('30 days')).toBeInTheDocument();
      expect(screen.getByText('60 days')).toBeInTheDocument();
    });
  });

  it('caps the bar at MAX_DAYS_CHART and classifies thresholds like the LWC', () => {
    expect(daysOnMarketStatus(29)).toBe('normal');
    expect(daysOnMarketStatus(30)).toBe('warning');
    expect(daysOnMarketStatus(60)).toBe('alert');
  });

  it('renders an error panel when there is an error', async () => {
    mockApi(() => jsonResponse({ statusCode: 500, message: 'boom' }, 500));
    renderWithProviders(<DaysOnMarket recordId={PROPERTY_RECORD.id} />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('Error retrieving data');
  });
});
