import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import type { AuthClient } from '@/auth/types';
import { createQueryClient } from './query-client';
import { theme } from './theme';

export function AppProviders({
  children,
  queryClient,
  authClient,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
  authClient?: AuthClient;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <QueryClientProvider client={client}>
        <AuthProvider client={authClient}>{children}</AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
