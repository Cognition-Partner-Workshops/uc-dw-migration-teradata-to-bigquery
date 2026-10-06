import type { BrokerDto, PropertyDto, PropertySummaryDto } from '@/api/types';

/** First record of lwc/propertyTileList/__tests__/data/getPagedPropertyList.json in API shape. */
export const PROPERTY: PropertySummaryDto = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Stunning Victorian',
  address: '127 Endicott St',
  city: 'Boston',
  state: 'MA',
  description: 'Lorem ipsum dolor sit amet',
  price: 450000,
  baths: 1,
  beds: 3,
  thumbnail: 'https://example.com/house07sq.jpg',
  latitude: 42.365985,
  longitude: -71.055972,
};

/** lwc/propertySummary/__tests__/data/getRecord.json (Property__c with its Broker__c lookup) in API shape. */
export const BROKER: BrokerDto = {
  id: '00000000-0000-4000-8000-00000000b001',
  brokerId: null,
  name: 'Caroline Kingsley',
  email: 'caroline@example.com',
  phone: '617-244-3672',
  mobilePhone: '617-244-3672',
  picture: null,
  sfId: null,
  title: 'Senior Broker',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const PROPERTY_RECORD: PropertyDto = {
  ...PROPERTY,
  picture: 'https://example.com/house07.jpg',
  brokerId: BROKER.id,
  assessedValue: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  dateAgreement: null,
  dateClosed: null,
  dateContracted: null,
  dateListed: null,
  datePreMarket: null,
  priceSold: null,
  sfId: null,
  status: 'Available',
  tags: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  zip: '02113',
};
