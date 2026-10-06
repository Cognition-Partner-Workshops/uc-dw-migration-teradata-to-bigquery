import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
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
