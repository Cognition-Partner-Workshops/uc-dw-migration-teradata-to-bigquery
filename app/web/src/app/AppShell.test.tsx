import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appTabs, visibleTabs } from '@/app/navigation';
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

  it('renders one navigation link per tab visible to the dreamhouse group (no Settings)', async () => {
    renderApp({ initialPath: '/', authClient: await signedInStubClient() });

    const nav = await screen.findByRole('navigation', { name: 'Dreamhouse tabs' });
    const links = within(nav).getAllByRole('link');
    const tabs = visibleTabs(['dreamhouse']);
    expect(tabs.length).toBe(appTabs.length - 1);
    expect(links.map((l) => l.textContent)).toEqual(tabs.map((t) => t.label));
    expect(links.map((l) => l.getAttribute('href'))).toEqual(tabs.map((t) => t.path));
    expect(links.map((l) => l.getAttribute('data-salesforce-tab'))).toEqual(
      tabs.map((t) => t.salesforceTab),
    );
    expect(screen.queryByTestId('tab-settings')).not.toBeInTheDocument();
  });

  it('Home tiles follow the same group filter as the navigation', async () => {
    renderApp({ initialPath: '/', authClient: await signedInStubClient() });
    await screen.findByRole('navigation', { name: 'Dreamhouse tabs' });
    // nav link + Home tile for a dreamhouse tab, neither for Settings
    expect(screen.getAllByRole('link', { name: /Property Explorer/ })).toHaveLength(2);
    expect(screen.queryAllByRole('link', { name: /Settings/ })).toHaveLength(0);
  });

  it('renders every tab, Settings included, for the dreamhouse-admin group', async () => {
    renderApp({ initialPath: '/', authClient: await signedInStubClient('admin@example.com') });

    const nav = await screen.findByRole('navigation', { name: 'Dreamhouse tabs' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(appTabs.map((t) => t.label));
  });

  it('a dreamhouse user opening /settings directly gets the access-denied page, not the tab', async () => {
    renderApp({ initialPath: '/settings', authClient: await signedInStubClient() });

    expect(await screen.findByTestId('access-denied')).toHaveTextContent(/dreamhouse-admin/);
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('a signed-in user without the dreamhouse group sees "Insufficient privileges" instead of the app', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPath: '/properties',
      authClient: await signedInStubClient('guest@example.com'),
    });

    expect(await screen.findByTestId('access-denied')).toHaveTextContent(
      /not in the Dreamhouse user group/,
    );
    expect(screen.queryByRole('navigation', { name: 'Dreamhouse tabs' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('navigates between tabs and marks the active one', async () => {
    const user = userEvent.setup();
    renderApp({ initialPath: '/', authClient: await signedInStubClient('admin@example.com') });

    await screen.findByRole('heading', { name: /welcome to dreamhouse/i });
    await user.click(screen.getByTestId('tab-settings'));

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByTestId('active-tab')).toHaveTextContent('Settings');
    expect(screen.getByTestId('tab-settings')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('sample-data-importer')).toBeInTheDocument();
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
