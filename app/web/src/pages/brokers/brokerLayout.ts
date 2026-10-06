import type { BrokerDto } from '@/api/types';
import type { FieldDef, FieldMap, LayoutSection } from '@/records/fields';

/** `Broker__c` fields (mapping.yaml `field:Broker__c.*`) keyed by their API name. */
export const BROKER_FIELDS = {
  name: { name: 'name', label: 'Broker Name', source: 'Name', type: 'text', required: true },
  title: { name: 'title', label: 'Title', source: 'Title__c', type: 'text' },
  email: { name: 'email', label: 'Email', source: 'Email__c', type: 'email' },
  phone: { name: 'phone', label: 'Phone', source: 'Phone__c', type: 'phone' },
  mobilePhone: {
    name: 'mobilePhone',
    label: 'Mobile Phone',
    source: 'Mobile_Phone__c',
    type: 'phone',
  },
  picture: { name: 'picture', label: 'Picture', source: 'Picture__c', type: 'url' },
  pictureImg: {
    name: 'pictureImg',
    label: 'Picture',
    source: 'Picture_IMG__c',
    type: 'image',
    imageOf: 'picture',
    readonly: true,
  },
  brokerId: {
    name: 'brokerId',
    label: 'Broker Id',
    source: 'Broker_Id__c',
    type: 'number',
    maximumFractionDigits: 0,
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

export type BrokerFieldName = keyof typeof BROKER_FIELDS;

/**
 * `flexipages/Broker_Record_Page` Details tab: Picture, Information (two columns), System
 * Information. `OwnerId` is left out (no record ownership in the target).
 */
export const BROKER_DETAIL_SECTIONS: readonly LayoutSection[] = [
  { label: 'Picture', columns: [['pictureImg', 'picture']] },
  {
    label: 'Information',
    columns: [
      ['name', 'title', 'email'],
      ['phone', 'mobilePhone'],
    ],
  },
  { label: 'System Information', columns: [['createdAt'], ['updatedAt']] },
];

/** `layouts/Broker__c-Broker Layout`: the New / Edit modal sections. */
export const BROKER_LAYOUT_SECTIONS: readonly LayoutSection[] = [
  { label: 'Picture', columns: [['pictureImg', 'picture']] },
  {
    label: 'Information',
    columns: [
      ['name', 'title', 'email'],
      ['phone', 'mobilePhone'],
    ],
  },
  { label: 'System Information', columns: [['createdAt'], ['updatedAt']] },
];

/** `compactLayouts/Broker_Compact`: the highlights panel fields. */
export const BROKER_HIGHLIGHTS: readonly BrokerFieldName[] = [
  'name',
  'title',
  'phone',
  'mobilePhone',
  'email',
];

/** `c/brokerCard` `lightning-record-form fields` (Name, Phone, Mobile Phone, Email), 2 columns. */
export const BROKER_CARD_SECTIONS: readonly LayoutSection[] = [
  {
    label: '',
    columns: [
      ['name', 'mobilePhone'],
      ['phone', 'email'],
    ],
  },
];

export const BROKER_OBJECT = {
  apiName: 'Broker__c',
  label: 'Broker',
  labelPlural: 'Brokers',
  route: '/brokers',
} as const;

export function brokerRoute(brokerId: string) {
  return `${BROKER_OBJECT.route}/${brokerId}`;
}

export type BrokerRecord = BrokerDto & Record<string, unknown>;

export const brokerFieldList: FieldDef[] = Object.values(BROKER_FIELDS);
