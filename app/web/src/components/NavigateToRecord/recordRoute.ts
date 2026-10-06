import { BROKER_OBJECT } from '@/pages/brokers/brokerLayout';
import { PROPERTY_OBJECT } from '@/pages/properties/propertyLayout';

export type RecordObjectApiName = typeof PROPERTY_OBJECT.apiName | typeof BROKER_OBJECT.apiName;

/** `standard__recordPage` + `actionName: 'view'` -> the record page route of the object. */
export function recordRoute(objectApiName: RecordObjectApiName, recordId: string): string {
  const route =
    objectApiName === BROKER_OBJECT.apiName ? BROKER_OBJECT.route : PROPERTY_OBJECT.route;
  return `${route}/${recordId}`;
}
