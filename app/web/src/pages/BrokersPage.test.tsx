import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { BROKER, PROPERTY_PAGE } from '@/test/fixtures/records';
import { renderApp, signedInStubClient } from '@/test/render';

function brokersApi() {
  const created: unknown[] = [];
  const api = mockApi(async (url, request) => {
    if (url.pathname === '/api/brokers' && request.method === 'GET') return jsonResponse([BROKER]);
    if (url.pathname === '/api/brokers' && request.method === 'POST') {
      created.push(await request.json());
      return jsonResponse({ ...BROKER, id: 'new-broker', name: 'New Broker' }, 201);
    }
    if (url.pathname === '/api/brokers/new-broker')
      return jsonResponse({ ...BROKER, id: 'new-broker', name: 'New Broker' });
    if (url.pathname === '/api/properties') return jsonResponse(PROPERTY_PAGE);
    if (url.pathname === '/api/health') return jsonResponse({ status: 'ok', version: '0.1.0' });
    return jsonResponse({ message: `no route ${url.pathname}` }, 404);
  });
  return { ...api, created };
}

describe('BrokersPage (tab Broker__c, list view All)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the single NAME column and links to the broker record', async () => {
    brokersApi();
    renderApp({ initialPath: '/brokers', authClient: await signedInStubClient() });
    const list = await screen.findByTestId('brokers-list');
    expect(
      within(list)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Broker Name']);
    expect(within(list).getByRole('link', { name: BROKER.name })).toHaveAttribute(
      'href',
      `/brokers/${BROKER.id}`,
    );
  });

  it('creates a broker from the New modal and opens its record page', async () => {
    const user = userEvent.setup();
    const { created } = brokersApi();
    const { router } = renderApp({
      initialPath: '/brokers',
      authClient: await signedInStubClient(),
    });
    await screen.findByTestId('brokers-list');
    await user.click(screen.getByTestId('record-action-new'));
    const form = await screen.findByTestId('broker-create-form');
    expect(
      within(form)
        .getAllByTestId('record-form-section')
        .map((s) => within(s).getByRole('heading').textContent),
    ).toEqual(['Picture', 'Information']);
    await user.type(within(form).getByTestId('input-name'), 'New Broker');
    await user.type(within(form).getByTestId('input-title'), 'Agent');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await screen.findByTestId('broker-record-page');
    expect(created).toEqual([{ name: 'New Broker', title: 'Agent' }]);
    expect(router.state.location.pathname).toBe('/brokers/new-broker');
  });
});
