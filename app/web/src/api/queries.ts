import { queryOptions } from '@tanstack/react-query';
import { api } from './client';
import type { PropertyQuery } from './types';

export const queryKeys = {
  health: ['health'] as const,
  properties: (query: PropertyQuery = {}) => ['properties', query] as const,
  property: (id: string) => ['properties', id] as const,
  propertyPictures: (id: string) => ['properties', id, 'pictures'] as const,
  file: (id: string) => ['files', id] as const,
  brokers: ['brokers'] as const,
  broker: (id: string) => ['brokers', id] as const,
  contacts: ['contacts'] as const,
};

/**
 * `@AuraEnabled(cacheable=true)` responses were served from the Lightning Data Service cache;
 * here the API answers them with `Cache-Control: private, max-age=30` and TanStack Query keeps
 * them fresh for the same 30 seconds (app/api/src/modules/properties/properties.controller.ts).
 */
export const CACHEABLE_STALE_TIME = 30_000;

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

/** `PropertyController.getPagedPropertyList` (propertyTileList's `@wire`): GET /properties. */
export const propertiesQuery = (query: PropertyQuery = {}) =>
  queryOptions({
    queryKey: queryKeys.properties(query),
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/properties', { params: { query }, signal });
      if (!response.ok || !data) {
        throw new Error(`Loading properties failed (${response.status})`);
      }
      return data;
    },
    staleTime: CACHEABLE_STALE_TIME,
    placeholderData: (previous) => previous,
  });

/** `PropertyController.getPictures` (propertyCarousel's `@wire`): GET /properties/{id}/pictures. */
export const propertyPicturesQuery = (propertyId: string) =>
  queryOptions({
    queryKey: queryKeys.propertyPictures(propertyId),
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/properties/{id}/pictures', {
        params: { path: { id: propertyId } },
        signal,
      });
      if (!response.ok || !data) {
        throw new Error(`Loading property pictures failed (${response.status})`);
      }
      return data;
    },
    staleTime: CACHEABLE_STALE_TIME,
    enabled: propertyId.length > 0,
  });

/**
 * `GET /files/{id}` (`ContentVersion.VersionData`, the carousel's image source). The route needs
 * the bearer token an `<img src>` cannot send, so the body is fetched here and shown via an
 * object URL; a file never changes once created, hence the infinite staleTime.
 */
export const fileQuery = (fileId: string) =>
  queryOptions({
    queryKey: queryKeys.file(fileId),
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/files/{id}', {
        params: { path: { id: fileId } },
        parseAs: 'blob',
        signal,
      });
      if (!response.ok || !data) {
        throw new Error(`Loading file failed (${response.status})`);
      }
      return data as Blob;
    },
    staleTime: Infinity,
    enabled: fileId.length > 0,
  });

/** LDS `getRecord` on Property__c (propertySummary / propertyMap's `@wire`): GET /properties/{id}. */
export const propertyQuery = (propertyId: string) =>
  queryOptions({
    queryKey: queryKeys.property(propertyId),
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/properties/{id}', {
        params: { path: { id: propertyId } },
        signal,
      });
      if (!response.ok || !data) {
        throw new Error(`Loading property ${propertyId} failed (${response.status})`);
      }
      return data;
    },
    staleTime: CACHEABLE_STALE_TIME,
    enabled: propertyId.length > 0,
  });

/** LDS `getRecord` on Broker__c (the `Broker__c` lookup of a record form): GET /brokers/{id}. */
export const brokerQuery = (brokerId: string) =>
  queryOptions({
    queryKey: queryKeys.broker(brokerId),
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/brokers/{id}', {
        params: { path: { id: brokerId } },
        signal,
      });
      if (!response.ok || !data) {
        throw new Error(`Loading broker ${brokerId} failed (${response.status})`);
      }
      return data;
    },
    staleTime: CACHEABLE_STALE_TIME,
    enabled: brokerId.length > 0,
  });

/** Broker__c tab list view / the Broker__c lookup options of a record form: GET /brokers. */
export const brokersQuery = queryOptions({
  queryKey: queryKeys.brokers,
  queryFn: async ({ signal }) => {
    const { data, response } = await api.GET('/brokers', { signal });
    if (!response.ok || !data) {
      throw new Error(`Loading brokers failed (${response.status})`);
    }
    return data;
  },
  staleTime: CACHEABLE_STALE_TIME,
});
