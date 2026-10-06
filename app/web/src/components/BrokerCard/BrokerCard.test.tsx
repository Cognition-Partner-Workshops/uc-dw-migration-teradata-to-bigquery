import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { BROKER, PROPERTY_RECORD } from '@/test/fixtures/records';
import { renderWithProviders } from '@/test/render';
import { BrokerCard } from './BrokerCard';

function brokerApi() {
  return mockApi((url, request) => {
    if (url.pathname === `/api/properties/${PROPERTY_RECORD.id}`)
      return jsonResponse(PROPERTY_RECORD);
    if (url.pathname === `/api/brokers/${BROKER.id}` && request.method === 'GET')
      return jsonResponse(BROKER);
    if (url.pathname === `/api/brokers/${BROKER.id}` && request.method === 'PATCH') {
      return jsonResponse(
        {
          statusCode: 400,
          message: 'Validation failed',
          output: {
            errors: [],
            fieldErrors: {
              phone: [{ field: 'phone', errorCode: 'INVALID', message: 'phone is too long' }],
            },
          },
        },
        400,
      );
    }
    return jsonResponse({ message: 'not found' }, 404);
  });
}

// Port of lwc/brokerCard/__tests__/brokerCard.test.js
describe('BrokerCard (c-broker-card)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('gets the broker of the property and renders the record form with the given fields', async () => {
    const { requests } = brokerApi();
    renderWithProviders(<BrokerCard propertyId={PROPERTY_RECORD.id} />);

    const form = await screen.findByTestId('broker-card-form');
    expect(screen.getByTestId('broker-card')).toHaveAttribute('data-broker-id', BROKER.id);
    expect(
      within(form)
        .getAllByTestId(/^field-/)
        .map((f) => f.getAttribute('data-field')),
    ).toEqual(['Name', 'Mobile_Phone__c', 'Phone__c', 'Email__c']);
    expect(within(form).getByTestId('field-name')).toHaveTextContent(BROKER.name);
    expect(requests().map((url) => url.pathname)).toEqual([
      `/api/properties/${PROPERTY_RECORD.id}`,
      `/api/brokers/${BROKER.id}`,
    ]);
  });

  it('navigates to record view', async () => {
    const user = userEvent.setup();
    brokerApi();
    const { router } = renderWithProviders(<BrokerCard propertyId={PROPERTY_RECORD.id} />);
    await user.click(await screen.findByRole('button', { name: 'Navigate to record' }));
    expect(router.state.location.pathname).toBe(`/brokers/${BROKER.id}`);
  });

  it('shows the server field error on the field when an inline edit fails', async () => {
    const user = userEvent.setup();
    brokerApi();
    renderWithProviders(<BrokerCard propertyId={PROPERTY_RECORD.id} />);
    await screen.findByTestId('broker-card-form');
    await user.click(screen.getByTestId('edit-phone'));
    await user.type(screen.getByTestId('input-phone'), '9');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('phone is too long')).toBeInTheDocument();
    expect(screen.getByTestId('input-phone')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders error if data is not retrieved successfully', async () => {
    mockApi(() => jsonResponse({ statusCode: 500, message: 'boom' }, 500));
    renderWithProviders(<BrokerCard propertyId={PROPERTY_RECORD.id} />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('Error retrieving data');
  });

  it('tells when the property has no broker', async () => {
    mockApi(() => jsonResponse({ ...PROPERTY_RECORD, brokerId: null }));
    renderWithProviders(<BrokerCard propertyId={PROPERTY_RECORD.id} />);
    expect(await screen.findByTestId('broker-card-empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Navigate to record' })).not.toBeInTheDocument();
  });
});
