import type { ListColumn } from '@/records/fields';

/** `objects/Property__c/listViews/All`: NAME, City__c, Beds__c, Price__c, Status__c. */
export const PROPERTY_LIST_VIEW = {
  apiName: 'All',
  label: 'All',
  columns: [
    { field: 'name', link: true },
    { field: 'city' },
    { field: 'beds' },
    { field: 'price' },
    { field: 'status' },
  ] satisfies ListColumn[],
} as const;
