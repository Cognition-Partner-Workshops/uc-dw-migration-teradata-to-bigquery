import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/routes';
import { createStubAuthClient } from '@/auth/stub-auth-client';
import type { AuthClient } from '@/auth/types';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

export async function signedInStubClient(username = 'jane.doe@example.com'): Promise<AuthClient> {
  const client = createStubAuthClient();
  await client.signIn({ username, password: 'pw' });
  return client;
}

/** Renders the real route tree at `initialPath` with test providers. */
export function renderApp({
  initialPath = '/',
  authClient,
  queryClient = createTestQueryClient(),
}: {
  initialPath?: string;
  authClient?: AuthClient;
  queryClient?: QueryClient;
} = {}) {
  const router = createTestRouter([initialPath]);
  const utils = render(
    <AppProviders queryClient={queryClient} authClient={authClient ?? createStubAuthClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router };
}

/**
 * Renders a component inside the app providers and a memory router at `initialPath` (so
 * `useSearchParams` / `useNavigate` work); `router.state.location` exposes the published URL.
 */
export function renderWithProviders(
  ui: ReactNode,
  {
    initialPath = '/',
    queryClient = createTestQueryClient(),
  }: { initialPath?: string; queryClient?: QueryClient } = {},
) {
  const router = createMemoryRouter([{ path: '*', element: ui }], {
    initialEntries: [initialPath],
  });
  const utils = render(
    <AppProviders queryClient={queryClient} authClient={createStubAuthClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router, queryClient };
}
