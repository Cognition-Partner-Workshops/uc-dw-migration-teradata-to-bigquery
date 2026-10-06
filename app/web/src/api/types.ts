import type { components, operations } from './schema';

export type Schemas = components['schemas'];

export type HealthDto = Schemas['HealthDto'];
export type PropertySummaryDto = Schemas['PropertySummaryDto'];
export type PagedPropertiesDto = Schemas['PagedPropertiesDto'];
export type PropertyPictureDto = Schemas['PropertyPictureDto'];
export type BrokerDto = Schemas['BrokerDto'];
export type ContactDto = Schemas['ContactDto'];

/** Query parameters of GET /properties (Apex `getPagedPropertyList` arguments). */
export type PropertyQuery = NonNullable<
  operations['properties_getPagedPropertyList']['parameters']['query']
>;
