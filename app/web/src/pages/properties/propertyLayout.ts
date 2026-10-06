import type { PropertyDto } from '@/api/types';
import type { FieldDef, FieldMap, LayoutSection } from '@/records/fields';

/** `Status__c` restricted picklist, in picklist order. */
export const PROPERTY_STATUSES = [
  'Contracted',
  'Pre Market',
  'Available',
  'Under Agreement',
  'Closed',
] as const;

/** `Days_On_Market__c = TODAY() - Date_Listed__c` (BlankAsZero), computed like `properties_v.days_on_market`. */
export function daysOnMarket(dateListed: string | null | undefined, today = new Date()): number {
  if (!dateListed) return 0;
  const [year, month, day] = dateListed.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 0;
  const listed = Date.UTC(year, month - 1, day);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((now - listed) / 86_400_000));
}

/** `Property__c` fields (mapping.yaml `field:Property__c.*`) keyed by their API name. */
export const PROPERTY_FIELDS = {
  name: { name: 'name', label: 'Property Name', source: 'Name', type: 'text', required: true },
  address: { name: 'address', label: 'Address', source: 'Address__c', type: 'text' },
  city: { name: 'city', label: 'City', source: 'City__c', type: 'text' },
  state: { name: 'state', label: 'State', source: 'State__c', type: 'text' },
  zip: { name: 'zip', label: 'Zip', source: 'Zip__c', type: 'text' },
  daysOnMarket: {
    name: 'daysOnMarket',
    label: 'Days On Market',
    source: 'Days_On_Market__c',
    type: 'number',
    readonly: true,
    derive: (record) => daysOnMarket(record.dateListed as string | null),
    maximumFractionDigits: 0,
  },
  tags: { name: 'tags', label: 'Tags', source: 'Tags__c', type: 'text' },
  status: {
    name: 'status',
    label: 'Status',
    source: 'Status__c',
    type: 'picklist',
    options: PROPERTY_STATUSES,
  },
  beds: {
    name: 'beds',
    label: 'Beds',
    source: 'Beds__c',
    type: 'number',
    maximumFractionDigits: 0,
  },
  baths: {
    name: 'baths',
    label: 'Baths',
    source: 'Baths__c',
    type: 'number',
    maximumFractionDigits: 0,
  },
  price: { name: 'price', label: 'Price', source: 'Price__c', type: 'currency' },
  assessedValue: {
    name: 'assessedValue',
    label: 'Assessed Value',
    source: 'Assessed_Value__c',
    type: 'currency',
  },
  priceSold: { name: 'priceSold', label: 'Price Sold', source: 'Price_Sold__c', type: 'currency' },
  location: {
    name: 'location',
    label: 'Location',
    source: 'Location__c',
    type: 'geolocation',
    parts: { latitude: 'latitude', longitude: 'longitude' },
  },
  brokerId: {
    name: 'brokerId',
    label: 'Broker',
    source: 'Broker__c',
    type: 'lookup',
    lookup: { object: 'Broker__c', route: '/brokers' },
  },
  description: {
    name: 'description',
    label: 'Description',
    source: 'Description__c',
    type: 'textarea',
  },
  dateContracted: {
    name: 'dateContracted',
    label: 'Date Contracted',
    source: 'Date_Contracted__c',
    type: 'date',
  },
  datePreMarket: {
    name: 'datePreMarket',
    label: 'Date Pre Market',
    source: 'Date_Pre_Market__c',
    type: 'date',
  },
  dateListed: { name: 'dateListed', label: 'Date Listed', source: 'Date_Listed__c', type: 'date' },
  dateAgreement: {
    name: 'dateAgreement',
    label: 'Date Agreement',
    source: 'Date_Agreement__c',
    type: 'date',
  },
  dateClosed: { name: 'dateClosed', label: 'Date Closed', source: 'Date_Closed__c', type: 'date' },
  picture: { name: 'picture', label: 'Picture', source: 'Picture__c', type: 'url' },
  pictureImg: {
    name: 'pictureImg',
    label: 'Main Picture',
    source: 'Picture_IMG__c',
    type: 'image',
    imageOf: 'picture',
    readonly: true,
  },
  thumbnail: { name: 'thumbnail', label: 'Thumbnail', source: 'Thumbnail__c', type: 'url' },
  thumbnailImg: {
    name: 'thumbnailImg',
    label: 'Thumbnail Picture',
    source: 'Thumbnail_IMG__c',
    type: 'image',
    imageOf: 'thumbnail',
    readonly: true,
  },
  createdAt: {
    name: 'createdAt',
    label: 'Created By',
    source: 'CreatedById',
    type: 'datetime',
    readonly: true,
  },
  updatedAt: {
    name: 'updatedAt',
    label: 'Last Modified By',
    source: 'LastModifiedById',
    type: 'datetime',
    readonly: true,
  },
} as const satisfies FieldMap;

export type PropertyFieldName = keyof typeof PROPERTY_FIELDS;

/**
 * `flexipages/Property_Record_Page` Details tab (`flexipage:fieldSection`s, same labels, columns
 * and field order). `OwnerId` has no counterpart (the target has no record ownership) and is left
 * out; `CreatedById` / `LastModifiedById` show the timestamps the API keeps.
 */
export const PROPERTY_DETAIL_SECTIONS: readonly LayoutSection[] = [
  {
    label: 'Information',
    columns: [['name', 'address', 'state', 'zip', 'tags', 'status'], ['pictureImg']],
  },
  { label: 'Description', columns: [['description']] },
  { label: 'System Information', columns: [['createdAt'], ['updatedAt']] },
];

/** `flexipages/Property_Record_Page` custom "Dates" tab. */
export const PROPERTY_DATES_SECTIONS: readonly LayoutSection[] = [
  {
    label: 'Dates',
    columns: [
      ['dateContracted', 'datePreMarket', 'dateClosed'],
      ['dateListed', 'dateAgreement'],
    ],
  },
];

/**
 * `layouts/Property__c-Property Layout`: the New / Edit modal of the standard actions (same
 * sections, columns and field order; "Custom Links" is empty and System Information is read-only).
 */
export const PROPERTY_LAYOUT_SECTIONS: readonly LayoutSection[] = [
  {
    label: 'Information',
    columns: [
      ['name', 'address', 'city', 'state', 'zip', 'daysOnMarket', 'tags'],
      ['status', 'beds', 'baths', 'price', 'location', 'brokerId'],
    ],
  },
  { label: 'Description', columns: [['description']] },
  {
    label: 'Dates',
    columns: [['dateContracted', 'datePreMarket', 'dateListed', 'dateAgreement', 'dateClosed']],
  },
  { label: 'Pictures', columns: [['picture', 'pictureImg', 'thumbnail', 'thumbnailImg']] },
  { label: 'System Information', columns: [['createdAt'], ['updatedAt']] },
];

/** `compactLayouts/Property_Compact_Layout`: the highlights panel fields. */
export const PROPERTY_HIGHLIGHTS: readonly PropertyFieldName[] = [
  'name',
  'city',
  'price',
  'beds',
  'baths',
];

/** `Broker__c-Broker Layout` related list `Property__c.Broker__c` (Properties__r) columns. */
export const BROKER_PROPERTIES_COLUMNS = [
  { field: 'name', link: true },
  { field: 'address' },
  { field: 'price' },
  { field: 'beds' },
  { field: 'baths' },
] as const;

export const PROPERTY_OBJECT = {
  apiName: 'Property__c',
  label: 'Property',
  labelPlural: 'Properties',
  route: '/properties',
} as const;

export function propertyRoute(propertyId: string) {
  return `${PROPERTY_OBJECT.route}/${propertyId}`;
}

export type PropertyRecord = PropertyDto & Record<string, unknown>;

export const propertyFieldList: FieldDef[] = Object.values(PROPERTY_FIELDS);
