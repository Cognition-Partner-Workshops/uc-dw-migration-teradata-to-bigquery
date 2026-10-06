import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { BROKER, PICTURES, PROPERTY_PAGE, PROPERTY_RECORD } from '@/test/fixtures/records';
import { renderApp, signedInStubClient } from '@/test/render';

vi.mock('@/components/MapView/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

function recordApi() {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  let record = { ...PROPERTY_RECORD };
  const api = mockApi(async (url, request) => {
    const body =
      request.method === 'PATCH' || request.method === 'POST' ? await request.json() : undefined;
    calls.push({ method: request.method, path: url.pathname, body });
    if (url.pathname === `/api/properties/${record.id}`) {
      if (request.method === 'PATCH') {
        if (body.price !== undefined && body.price < 0) {
          return jsonResponse(
            {
              statusCode: 400,
              message: 'Validation failed',
              output: {
                errors: [],
                fieldErrors: {
                  price: [
                    { field: 'price', errorCode: 'MIN', message: 'price must not be less than 0' },
                  ],
                },
              },
            },
            400,
          );
        }
        record = { ...record, ...body };
        return jsonResponse(record);
      }
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse(record);
    }
    if (url.pathname === `/api/properties/${record.id}/pictures`) return jsonResponse(PICTURES);
    if (url.pathname === '/api/properties') return jsonResponse(PROPERTY_PAGE);
    if (url.pathname === `/api/brokers/${BROKER.id}`) return jsonResponse(BROKER);
    if (url.pathname === '/api/brokers') return jsonResponse([BROKER]);
    if (url.pathname === '/api/health') return jsonResponse({ status: 'ok', version: '0.1.0' });
    return jsonResponse({ message: `no route ${url.pathname}` }, 404);
  });
  return { ...api, calls };
}

describe('PropertyRecordPage (flexipage Property_Record_Page)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the highlights (compact layout), the Details sections in layout order and the sidebar components', async () => {
    recordApi();
    renderApp({
      initialPath: `/properties/${PROPERTY_RECORD.id}`,
      authClient: await signedInStubClient(),
    });
    await screen.findByTestId('property-record-page');

    expect(screen.getByTestId('record-highlights-name')).toHaveTextContent(PROPERTY_RECORD.name);
    expect(
      within(screen.getByTestId('record-highlights-fields'))
        .getAllByTestId(/^highlight-/)
        .map((el) => el.getAttribute('data-field')),
    ).toEqual(['City__c', 'Price__c', 'Beds__c', 'Baths__c']);

    const details = screen.getByTestId('property-detail-form');
    const sections = within(details).getAllByTestId('record-form-section');
    expect(sections.map((s) => within(s).getByRole('heading').textContent)).toEqual([
      'Information',
      'Description',
      'System Information',
    ]);
    expect(
      within(sections[0])
        .getAllByTestId(/^field-/)
        .map((f) => f.getAttribute('data-field')),
    ).toEqual([
      'Name',
      'Address__c',
      'State__c',
      'Zip__c',
      'Tags__c',
      'Status__c',
      'Picture_IMG__c',
    ]);

    const sidebar = screen.getByTestId('record-sidebar');
    expect([...sidebar.children].map((child) => child.getAttribute('data-testid'))).toEqual([
      'broker-card',
      'days-on-market',
      'property-map',
      'property-location',
      'property-carousel',
    ]);
    expect(await within(sidebar).findByTestId('broker-card-form')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Related',
      'Details',
      'Dates',
      'Broker',
    ]);
  });

  it('inline edits a field, shows the server error on it, then saves with PATCH', async () => {
    const user = userEvent.setup();
    const { calls } = recordApi();
    renderApp({
      initialPath: `/properties/${PROPERTY_RECORD.id}`,
      authClient: await signedInStubClient(),
    });
    await screen.findByTestId('property-record-page');

    await user.click(screen.getByTestId('record-action-edit'));
    const form = await screen.findByTestId('property-edit-form');
    expect(
      within(form)
        .getAllByTestId('record-form-section')
        .map((s) => within(s).getByRole('heading').textContent),
    ).toEqual(['Information', 'Description', 'Dates', 'Pictures', 'System Information']);
    const price = within(form).getByTestId('input-price');
    await user.clear(price);
    await user.type(price, '-5');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByText('price must not be less than 0')).toBeInTheDocument();
    expect(price).toHaveAttribute('aria-invalid', 'true');

    await user.clear(price);
    await user.type(price, '500000');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByTestId('property-edit-form')).not.toBeInTheDocument());
    const patches = calls.filter((call) => call.method === 'PATCH');
    expect(patches.map((call) => call.body)).toEqual([
      { price: -5, geocode: false },
      { price: 500000, geocode: false },
    ]);
    expect(screen.getByTestId('highlight-price')).toHaveTextContent('$500,000');
  });

  it('switches to the Dates tab and the Related files list', async () => {
    const user = userEvent.setup();
    recordApi();
    renderApp({
      initialPath: `/properties/${PROPERTY_RECORD.id}`,
      authClient: await signedInStubClient(),
    });
    await screen.findByTestId('property-record-page');
    await user.click(screen.getByRole('tab', { name: 'Dates' }));
    const dates = await screen.findByTestId('property-dates-form');
    expect(
      within(dates)
        .getAllByTestId(/^field-/)
        .map((f) => f.getAttribute('data-field')),
    ).toEqual([
      'Date_Contracted__c',
      'Date_Pre_Market__c',
      'Date_Closed__c',
      'Date_Listed__c',
      'Date_Agreement__c',
    ]);
    await user.click(screen.getByRole('tab', { name: 'Related' }));
    expect(await screen.findByTestId('property-files-title')).toHaveTextContent('Files(2)');
    expect(screen.getAllByTestId('property-file')).toHaveLength(2);
  });

  it('deletes the record after confirmation and returns to the list view', async () => {
    const user = userEvent.setup();
    const { calls } = recordApi();
    const { router } = renderApp({
      initialPath: `/properties/${PROPERTY_RECORD.id}`,
      authClient: await signedInStubClient(),
    });
    await screen.findByTestId('property-record-page');
    await user.click(screen.getByTestId('record-action-delete'));
    await user.click(await screen.findByTestId('delete-record-confirm'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/properties'));
    expect(
      calls.some(
        (call) => call.method === 'DELETE' && call.path === `/api/properties/${PROPERTY_RECORD.id}`,
      ),
    ).toBe(true);
  });
});
