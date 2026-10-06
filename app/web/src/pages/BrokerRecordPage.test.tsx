import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { BROKER, PROPERTY, PROPERTY_PAGE } from '@/test/fixtures/records';
import { renderApp, signedInStubClient } from '@/test/render';

function brokerApi() {
  const calls: { method: string; path: string; search: string; body?: unknown }[] = [];
  let record = { ...BROKER };
  const api = mockApi(async (url, request) => {
    const body = request.method === 'PATCH' ? await request.json() : undefined;
    calls.push({ method: request.method, path: url.pathname, search: url.search, body });
    if (url.pathname === `/api/brokers/${BROKER.id}`) {
      if (request.method === 'PATCH') {
        record = { ...record, ...body };
        return jsonResponse(record);
      }
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse(record);
    }
    if (url.pathname === '/api/brokers') return jsonResponse([record]);
    if (url.pathname === '/api/properties') return jsonResponse(PROPERTY_PAGE);
    if (url.pathname === '/api/health') return jsonResponse({ status: 'ok', version: '0.1.0' });
    return jsonResponse({ message: `no route ${url.pathname}` }, 404);
  });
  return { ...api, calls };
}

describe('BrokerRecordPage (flexipage Broker_Record_Page)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders highlights, Details sections in layout order and the Properties__r related list', async () => {
    const { calls } = brokerApi();
    renderApp({ initialPath: `/brokers/${BROKER.id}`, authClient: await signedInStubClient() });
    await screen.findByTestId('broker-record-page');

    expect(screen.getByTestId('record-highlights-name')).toHaveTextContent(BROKER.name);
    expect(
      within(screen.getByTestId('record-highlights-fields'))
        .getAllByTestId(/^highlight-/)
        .map((el) => el.getAttribute('data-field')),
    ).toEqual(['Title__c', 'Phone__c', 'Mobile_Phone__c', 'Email__c']);

    const sections = within(screen.getByTestId('broker-detail-form')).getAllByTestId(
      'record-form-section',
    );
    expect(sections.map((s) => within(s).getByRole('heading').textContent)).toEqual([
      'Picture',
      'Information',
      'System Information',
    ]);

    const related = within(screen.getByTestId('record-sidebar')).getByTestId('broker-properties');
    expect(await within(related).findByTestId('broker-properties-title')).toHaveTextContent(
      'Properties(1)',
    );
    const list = within(related).getByTestId('broker-properties-list');
    expect(
      within(list)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Property Name', 'Address', 'Price', 'Beds', 'Baths']);
    expect(within(list).getByRole('link', { name: PROPERTY.name })).toHaveAttribute(
      'href',
      `/properties/${PROPERTY.id}`,
    );
    const relatedCall = calls.find((call) => call.path === '/api/properties');
    expect(new URLSearchParams(relatedCall?.search).get('brokerId')).toBe(BROKER.id);
  });

  it('inline edits the title and PATCHes only that field', async () => {
    const user = userEvent.setup();
    const { calls } = brokerApi();
    renderApp({ initialPath: `/brokers/${BROKER.id}`, authClient: await signedInStubClient() });
    await screen.findByTestId('broker-record-page');
    const form = screen.getByTestId('broker-detail-form');
    await user.click(within(form).getByTestId('edit-title'));
    await user.clear(within(form).getByTestId('input-title'));
    await user.type(within(form).getByTestId('input-title'), 'Managing Broker');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(form).toHaveAttribute('data-mode', 'view'));
    expect(calls.filter((call) => call.method === 'PATCH').map((call) => call.body)).toEqual([
      { title: 'Managing Broker' },
    ]);
    expect(screen.getByTestId('highlight-title')).toHaveTextContent('Managing Broker');
  });

  it('deletes the broker and returns to the list view', async () => {
    const user = userEvent.setup();
    const { calls } = brokerApi();
    const { router } = renderApp({
      initialPath: `/brokers/${BROKER.id}`,
      authClient: await signedInStubClient(),
    });
    await screen.findByTestId('broker-record-page');
    await user.click(screen.getByTestId('record-action-delete'));
    await user.click(await screen.findByTestId('delete-record-confirm'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/brokers'));
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });
});
