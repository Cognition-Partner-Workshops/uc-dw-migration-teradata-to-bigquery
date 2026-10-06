import type { components, operations } from './schema';

export type Schemas = components['schemas'];

export type HealthDto = Schemas['HealthDto'];
export type PropertySummaryDto = Schemas['PropertySummaryDto'];
export type PropertyDto = Schemas['PropertyDto'];
export type PagedPropertiesDto = Schemas['PagedPropertiesDto'];
export type PropertyPictureDto = Schemas['PropertyPictureDto'];
export type BrokerDto = Schemas['BrokerDto'];
export type ContactDto = Schemas['ContactDto'];
export type CreatePropertyDto = Schemas['CreatePropertyDto'];
export type UpdatePropertyDto = Schemas['UpdatePropertyDto'];
export type CreateBrokerDto = Schemas['CreateBrokerDto'];
export type UpdateBrokerDto = Schemas['UpdateBrokerDto'];
export type CreateFileDto = Schemas['CreateFileDto'];
export type FileCreatedDto = Schemas['FileCreatedDto'];
export type ApiErrorDto = Schemas['ApiErrorDto'];
export type FieldErrorDto = Schemas['FieldErrorDto'];

/** Query parameters of GET /properties (Apex `getPagedPropertyList` arguments). */
export type PropertyQuery = NonNullable<
  operations['properties_getPagedPropertyList']['parameters']['query']
>;
