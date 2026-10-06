import { Navigate } from 'react-router-dom';
import { PROPERTY_OBJECT } from '@/pages/properties/propertyLayout';
import { recordRoute, type RecordObjectApiName } from './recordRoute';

/**
 * Port of `c/navigateToRecord`: `NavigationMixin.Navigate({ type: 'standard__recordPage',
 * attributes: { recordId, actionName: 'view' } })` on connect -> a router redirect.
 */
export function NavigateToRecord({
  recordId,
  objectApiName = PROPERTY_OBJECT.apiName,
}: {
  recordId: string;
  objectApiName?: RecordObjectApiName;
}) {
  return <Navigate to={recordRoute(objectApiName, recordId)} replace />;
}
