import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearRememberedProperties, rememberProperties } from '@/state/selectedProperty';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { BROKER, PROPERTY, PROPERTY_RECORD } from '@/test/fixtures/property';
import { renderWithProviders } from '@/test/render';
import { PropertySummary } from './PropertySummary';

// Port of lwc/propertySummary/__tests__/propertySummary.test.js (getRecord -> GET /properties/{id})
describe('PropertySummary (c-property-summary)', () => {
  beforeEach(() => {
    clearRememberedProperties();
  });

  function mockRecordApi() {
    return mockApi((url) => {
      if (url.pathname === `/api/properties/${PROPERTY_RECORD.id}`) {
        return jsonResponse(PROPERTY_RECORD);
      }
      if (url.pathname === `/api/brokers/${BROKER.id}`) {
        return jsonResponse(BROKER);
      }
      return jsonResponse({ statusCode: 404, message: 'Not Found' }, 404);
    });
  }

  it('renders an error panel when no property is selected', () => {
    const api = mockRecordApi();
    renderWithProviders(<PropertySummary />);
    expect(screen.getByTestId('error-panel')).toHaveTextContent('Select a property to see details');
    expect(api.requests()).toHaveLength(0);
  });

  it('renders an error panel when getRecord fails', async () => {
    mockRecordApi();
    renderWithProviders(<PropertySummary />, { initialPath: '/?selected=unknown-id' });
    expect(screen.getByTestId('property-summary-loading')).toBeInTheDocument();
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('Error retrieving data');
    expect(screen.queryByTestId('property-summary-form')).toBeNull();
  });

  it('renders the record form with the broker when a property is selected', async () => {
    const api = mockRecordApi();
    renderWithProviders(<PropertySummary />, { initialPath: `/?selected=${PROPERTY_RECORD.id}` });

    expect(await screen.findByTestId('property-summary-name')).toHaveTextContent(PROPERTY.name);
    expect(screen.getByAltText('Property picture')).toHaveAttribute('src', PROPERTY_RECORD.picture);
    const form = screen.getByTestId('property-summary-form');
    expect(form).toHaveTextContent('Beds');
    expect(form).toHaveTextContent('Baths');
    expect(form).toHaveTextContent('Price');
    expect(form).toHaveTextContent('Broker');
    expect(screen.getByTestId('property-summary-beds')).toHaveTextContent('3');
    expect(screen.getByTestId('property-summary-baths')).toHaveTextContent('1');
    expect(screen.getByTestId('property-summary-price')).toHaveTextContent('$450,000.00');

    const brokerLink = await screen.findByTestId('property-summary-broker-link');
    expect(brokerLink).toHaveTextContent(BROKER.name);
    expect(brokerLink).toHaveAttribute('href', `/brokers/${BROKER.id}`);
    expect(screen.queryByTestId('error-panel')).toBeNull();
    expect(api.requests().map((url) => url.pathname)).toEqual([
      `/api/properties/${PROPERTY_RECORD.id}`,
      `/api/brokers/${BROKER.id}`,
    ]);
  });

  it('shows the list record immediately while getRecord loads, then the broker', async () => {
    mockRecordApi();
    rememberProperties([PROPERTY]);
    renderWithProviders(<PropertySummary />, { initialPath: `/?selected=${PROPERTY.id}` });

    expect(screen.getByTestId('property-summary-name')).toHaveTextContent(PROPERTY.name);
    expect(screen.getByAltText('Property picture')).toHaveAttribute('src', PROPERTY.thumbnail);
    expect(screen.getByTestId('property-summary-broker')).toHaveTextContent(/^Broker$/);

    expect(await screen.findByTestId('property-summary-broker-link')).toHaveTextContent(
      BROKER.name,
    );
    await waitFor(() =>
      expect(screen.getByAltText('Property picture')).toHaveAttribute(
        'src',
        PROPERTY_RECORD.picture,
      ),
    );
  });

  it('renders an empty broker when the property has no Broker__c', async () => {
    mockApi((url) =>
      url.pathname === `/api/properties/${PROPERTY_RECORD.id}`
        ? jsonResponse({ ...PROPERTY_RECORD, brokerId: null })
        : jsonResponse({ statusCode: 404, message: 'Not Found' }, 404),
    );
    renderWithProviders(<PropertySummary />, { initialPath: `/?selected=${PROPERTY_RECORD.id}` });

    expect(await screen.findByTestId('property-summary-broker')).toHaveTextContent('—');
    expect(screen.queryByTestId('property-summary-broker-link')).toBeNull();
  });

  it('navigates to the record page from the Navigate to Record action', async () => {
    mockRecordApi();
    const user = userEvent.setup();
    const { router } = renderWithProviders(<PropertySummary />, {
      initialPath: `/?selected=${PROPERTY_RECORD.id}`,
    });

    await user.click(await screen.findByRole('button', { name: 'Navigate to Record' }));
    expect(router.state.location.pathname).toBe(`/properties/${PROPERTY_RECORD.id}`);
  });
});
