import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appTabs } from '@/app/navigation';
import { renderApp, signedInStubClient } from '@/test/render';

const healthResponse = {
  status: 'ok',
  service: 'dreamhouse-api',
  version: '0.1.0',
  timestamp: '2026-10-06T00:00:00.000Z',
  uptimeSeconds: 12,
};

describe('AppShell', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      const body = url.endsWith('/brokers') ? [] : healthResponse;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders one navigation link per configured tab', async () => {
    renderApp({ initialPath: '/', authClient: await signedInStubClient() });

    const nav = await screen.findByRole('navigation', { name: 'Dreamhouse tabs' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(appTabs.map((t) => t.label));
    expect(links.map((l) => l.getAttribute('href'))).toEqual(appTabs.map((t) => t.path));
    expect(links.map((l) => l.getAttribute('data-salesforce-tab'))).toEqual(
      appTabs.map((t) => t.salesforceTab),
    );
  });

  it('navigates between tabs and marks the active one', async () => {
    const user = userEvent.setup();
    renderApp({ initialPath: '/', authClient: await signedInStubClient() });

    await screen.findByRole('heading', { name: /welcome to dreamhouse/i });
    await user.click(screen.getByTestId('tab-settings'));

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByTestId('active-tab')).toHaveTextContent('Settings');
    expect(screen.getByTestId('tab-settings')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('migration-placeholder')).toHaveTextContent('UNT3-22');
  });

  it('shows the API health from GET /health through the typed client', async () => {
    renderApp({ initialPath: '/', authClient: await signedInStubClient() });

    await waitFor(() => expect(screen.getByTestId('api-status')).toHaveTextContent('API 0.1.0'));
    const call = vi.mocked(fetch).mock.calls[0][0] as Request;
    expect(call.url).toBe('http://localhost:3000/api/health');
    expect(call.headers.get('authorization')).toBe('Bearer stub-token-for-jane.doe@example.com');
  });

  it('signs out from the user menu and returns to the login page', async () => {
    const user = userEvent.setup();
    renderApp({ initialPath: '/brokers', authClient: await signedInStubClient() });

    await screen.findByRole('heading', { name: 'Brokers' });
    await user.click(screen.getByRole('button', { name: 'User menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /sign out/i }));

    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
  });
});
