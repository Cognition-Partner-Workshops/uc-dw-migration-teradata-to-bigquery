import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { toApiRequestError } from './errors';
import { queryKeys } from './queries';
import type {
  BrokerDto,
  CreateBrokerDto,
  CreateFileDto,
  CreatePropertyDto,
  FileCreatedDto,
  PropertyDto,
  UpdateBrokerDto,
  UpdatePropertyDto,
} from './types';

/**
 * The LDS write functions (`createRecord`, `updateRecord`, `deleteRecord`) and
 * `FileUtilities.createFile` as TanStack mutations. Every one invalidates the queries LDS
 * refreshed on its own: the record, the lists it appears in and the related lists.
 */

/** LDS `createRecord(Property__c)` / the Create_property flow: POST /properties. */
export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePropertyDto): Promise<PropertyDto> => {
      const { data, error, response } = await api.POST('/properties', { body });
      if (!response.ok || !data) throw toApiRequestError(response, error, 'Creating the property');
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['properties'] }),
  });
}

/** LDS `updateRecord(Property__c)` (record page Edit, inline edit): PATCH /properties/{id}. */
export function useUpdateProperty(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdatePropertyDto): Promise<PropertyDto> => {
      const { data, error, response } = await api.PATCH('/properties/{id}', {
        params: { path: { id: propertyId } },
        body,
      });
      if (!response.ok || !data) throw toApiRequestError(response, error, 'Saving the property');
      return data;
    },
    onSuccess: (property) => {
      queryClient.setQueryData(queryKeys.property(propertyId), property);
      return queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

/** LDS `deleteRecord(Property__c)`: DELETE /properties/{id}. */
export function useDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (propertyId: string) => {
      const { error, response } = await api.DELETE('/properties/{id}', {
        params: { path: { id: propertyId } },
      });
      if (!response.ok) throw toApiRequestError(response, error, 'Deleting the property');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['properties'] }),
  });
}

/** LDS `createRecord(Broker__c)`: POST /brokers. */
export function useCreateBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBrokerDto): Promise<BrokerDto> => {
      const { data, error, response } = await api.POST('/brokers', { body });
      if (!response.ok || !data) throw toApiRequestError(response, error, 'Creating the broker');
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.brokers }),
  });
}

/** LDS `updateRecord(Broker__c)`: PATCH /brokers/{id}. */
export function useUpdateBroker(brokerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateBrokerDto): Promise<BrokerDto> => {
      const { data, error, response } = await api.PATCH('/brokers/{id}', {
        params: { path: { id: brokerId } },
        body,
      });
      if (!response.ok || !data) throw toApiRequestError(response, error, 'Saving the broker');
      return data;
    },
    onSuccess: (broker) => {
      queryClient.setQueryData(queryKeys.broker(brokerId), broker);
      return queryClient.invalidateQueries({ queryKey: queryKeys.brokers });
    },
  });
}

/** LDS `deleteRecord(Broker__c)`: DELETE /brokers/{id}. */
export function useDeleteBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brokerId: string) => {
      const { error, response } = await api.DELETE('/brokers/{id}', {
        params: { path: { id: brokerId } },
      });
      if (!response.ok) throw toApiRequestError(response, error, 'Deleting the broker');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.brokers }),
  });
}

/** `FileUtilities.createFile(base64data, filename, recordId)`: POST /files. */
export function useCreateFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateFileDto): Promise<FileCreatedDto> => {
      const { data, error, response } = await api.POST('/files', { body });
      if (!response.ok || !data) throw toApiRequestError(response, error, 'Uploading the file');
      return data;
    },
    onSuccess: (_file, body) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyPictures(body.recordId) }),
  });
}
