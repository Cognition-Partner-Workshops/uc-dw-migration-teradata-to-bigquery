import type { ListColumn } from '@/records/fields';

/** `objects/Broker__c/listViews/All`: NAME. */
export const BROKER_LIST_VIEW = {
  apiName: 'All',
  label: 'All',
  columns: [{ field: 'name', link: true }] satisfies ListColumn[],
} as const;
