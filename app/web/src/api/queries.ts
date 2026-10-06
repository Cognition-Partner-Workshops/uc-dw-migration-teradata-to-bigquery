import { queryOptions } from '@tanstack/react-query';
import { api } from './client';

export const queryKeys = {
  health: ['health'] as const,
  properties: (query: Record<string, unknown> = {}) => ['properties', query] as const,
  property: (id: string) => ['properties', id] as const,
  brokers: ['brokers'] as const,
  broker: (id: string) => ['brokers', id] as const,
  contacts: ['contacts'] as const,
};

export const healthQuery = queryOptions({
  queryKey: queryKeys.health,
  queryFn: async ({ signal }) => {
    const { data, response } = await api.GET('/health', { signal });
    if (!response.ok || !data) {
      throw new Error(`API health check failed (${response.status})`);
    }
    return data;
  },
  staleTime: 30_000,
  refetchInterval: 60_000,
  retry: false,
});
