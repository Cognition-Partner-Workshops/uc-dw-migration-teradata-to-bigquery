import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { authClient } from '@/auth/auth-client';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await authClient.getAccessToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
};

/** Relative bases (`/api`) are resolved against the page origin so `Request` objects are always absolute. */
export function resolveBaseUrl(baseUrl: string): string {
  if (/^https?:\/\//.test(baseUrl) || typeof window === 'undefined') {
    return baseUrl;
  }
  return new URL(baseUrl, window.location.origin).toString().replace(/\/$/, '');
}

export function createApiClient(baseUrl: string = API_BASE_URL) {
  const client = createClient<paths>({
    baseUrl: resolveBaseUrl(baseUrl),
    // resolved per call so test doubles / polyfills installed after module load are honoured
    fetch: (input) => globalThis.fetch(input),
  });
  client.use(authMiddleware);
  return client;
}

/** Typed client for the Dreamhouse API; paths/params/responses come from the generated schema. */
export const api = createApiClient();

export type ApiClient = ReturnType<typeof createApiClient>;
