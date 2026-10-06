import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { BROKER, PROPERTY, PROPERTY_PAGE, PROPERTY_RECORD } from '@/test/fixtures/records';
import { renderApp, signedInStubClient } from '@/test/render';

vi.mock('@/components/MapView/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

function listApi() {
  const created: unknown[] = [];
  const api = mockApi(async (url, request) => {
    if (url.pathname === '/api/properties' && request.method === 'GET')
      return jsonResponse(PROPERTY_PAGE);
    if (url.pathname === '/api/properties' && request.method === 'POST') {
      const body = await request.json();
      created.push(body);
      if (!body.city) {
        return jsonResponse(
          {
            statusCode: 400,
            message: 'Validation failed',
            output: {
              errors: [],
              fieldErrors: {
                city: [
                  {
                    field: 'city',
                    errorCode: 'REQUIRED',
                    message: 'city is required for geocoding',
                  },
                ],
              },
            },
          },
          400,
        );
      }
      return jsonResponse({ ...PROPERTY_RECORD, ...body, id: 'new-id' }, 201);
    }
    if (url.pathname === '/api/properties/new-id')
      return jsonResponse({ ...PROPERTY_RECORD, id: 'new-id', name: 'Brand New' });
    if (url.pathname === '/api/properties/new-id/pictures') return jsonResponse([]);
    if (url.pathname === '/api/brokers') return jsonResponse([BROKER]);
    if (url.pathname === `/api/brokers/${BROKER.id}`) return jsonResponse(BROKER);
    if (url.pathname === '/api/health') return jsonResponse({ status: 'ok', version: '0.1.0' });
    return jsonResponse({ message: `no route ${url.pathname}` }, 404);
  });
  return { ...api, created };
}

describe('PropertiesPage (tab Property__c, list view All)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the list view columns of listViews/All in order and links the name to the record', async () => {
    listApi();
    renderApp({ initialPath: '/properties', authClient: await signedInStubClient() });
    const list = await screen.findByTestId('properties-list');
    expect(
      within(list)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Property Name', 'City', 'Beds', 'Price', 'Status']);
    const row = within(list).getByTestId('properties-list-row');
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/properties/${PROPERTY.id}`);
    expect(row).toHaveTextContent('Boston');
    expect(row).toHaveTextContent('$450,000');
  });

  it('creates a record from the New modal (page layout sections) and navigates to it; field errors show inline', async () => {
    const user = userEvent.setup();
    const { created } = listApi();
    const { router } = renderApp({
      initialPath: '/properties',
      authClient: await signedInStubClient(),
    });
    await screen.findByTestId('properties-list');

    await user.click(screen.getByTestId('record-action-new'));
    const form = await screen.findByTestId('property-create-form');
    expect(
      within(form)
        .getAllByTestId('record-form-section')
        .map((s) => within(s).getByRole('heading').textContent),
    ).toEqual(['Information', 'Description', 'Dates', 'Pictures']);
    expect(
      within(within(form).getAllByTestId('record-form-section')[0])
        .getAllByTestId(/^field-/)
        .map((f) => f.getAttribute('data-field')),
    ).toEqual([
      'Name',
      'Address__c',
      'City__c',
      'State__c',
      'Zip__c',
      'Days_On_Market__c',
      'Tags__c',
      'Status__c',
      'Beds__c',
      'Baths__c',
      'Price__c',
      'Location__c',
      'Broker__c',
    ]);

    await user.type(within(form).getByTestId('input-name'), 'Brand New');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByText('city is required for geocoding')).toBeInTheDocument();
    expect(created[0]).toEqual({ name: 'Brand New', geocode: false });

    await user.type(within(form).getByTestId('input-city'), 'Boston');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await screen.findByTestId('property-record-page');
    expect(router.state.location.pathname).toBe('/properties/new-id');
    expect(created[1]).toEqual({ name: 'Brand New', city: 'Boston', geocode: false });
  });
});
