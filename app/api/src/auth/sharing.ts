/**
 * Row-level access: the org-wide defaults of the objects (`<sharingModel>` in the object
 * metadata) combined with the caller's View All / Modify All grants, as `with sharing`
 * Apex and Lightning Data Service applied them. Both custom objects are Public Read/Write,
 * and the `dreamhouse` permission set carries viewAllRecords/modifyAllRecords, so for the
 * ported app the filter is empty — the rules are still evaluated so a tighter default
 * (Contact) or a group without View All behaves as the org would.
 */
import { NotFoundException } from '@nestjs/common';
import { InsufficientAccessException } from './auth.exceptions';
import { currentPrincipal } from './request-context';
import { effectiveObjectGrant, type Operation, type SfObject } from './policy';
import type { Principal } from './principal';

/** Salesforce `sharingModel` values used here (`ControlledByParent` = the parent's access; no parent → owner only). */
export type SharingModel = 'Private' | 'Read' | 'ReadWrite' | 'ControlledByParent';

export const ORG_WIDE_DEFAULTS: Record<SfObject, SharingModel> = {
  // objects/Property__c/Property__c.object-meta.xml <sharingModel>ReadWrite</sharingModel>
  Property__c: 'ReadWrite',
  // objects/Broker__c/Broker__c.object-meta.xml <sharingModel>ReadWrite</sharingModel>
  Broker__c: 'ReadWrite',
  // Standard object, not in the source tree: Developer/scratch org default is Controlled by
  // Parent (Account); the Dreamhouse contacts have no Account, so only the owner sees them.
  Contact: 'ControlledByParent',
  // Files are visible through the record they are linked to (ContentDocumentLink).
  ContentDocument: 'ControlledByParent',
};

export interface OwnershipFilter {
  ownerId?: string;
}

/**
 * The `where` fragment to AND into a query for `operation` on `object`: `{}` when the caller
 * sees every record, `{ ownerId }` when only their own. No principal (seed script, batch
 * import) = system context, no filter.
 */
export function recordAccessWhere(
  object: SfObject,
  operation: Exclude<Operation, 'create'>,
  principal: Principal | undefined = currentPrincipal(),
): OwnershipFilter {
  if (!principal) return {};
  const grant = effectiveObjectGrant(principal.groups, object);
  const owd = ORG_WIDE_DEFAULTS[object];
  if (grant.modifyAllRecords) return {};
  switch (operation) {
    case 'read':
      if (grant.viewAllRecords || owd === 'Read' || owd === 'ReadWrite') return {};
      break;
    case 'edit':
      if (owd === 'ReadWrite') return {};
      break;
    case 'delete':
      // Public Read/Write still only lets the owner (or Modify All) delete.
      break;
  }
  return { ownerId: principal.sub };
}

/** True when the caller may perform `operation` on this particular row. */
export function canAccessRecord(
  object: SfObject,
  operation: Exclude<Operation, 'create'>,
  row: { ownerId: string | null },
  principal: Principal | undefined = currentPrincipal(),
): boolean {
  const filter = recordAccessWhere(object, operation, principal);
  return filter.ownerId === undefined || filter.ownerId === row.ownerId;
}

/**
 * Enforces `canAccessRecord` on a loaded row: a record the caller cannot see is reported as
 * not found (SOQL simply does not return it); one they can see but not change is 403
 * (DML: INSUFFICIENT_ACCESS_OR_READONLY).
 */
export function assertRecordAccess(
  object: SfObject,
  operation: Exclude<Operation, 'create'>,
  row: { ownerId: string | null },
  principal: Principal | undefined = currentPrincipal(),
): void {
  if (canAccessRecord(object, operation, row, principal)) return;
  if (operation === 'read' || !canAccessRecord(object, 'read', row, principal)) {
    throw new NotFoundException(`${object} record not found`);
  }
  throw new InsufficientAccessException(
    `Insufficient access rights on ${object}: you are not the owner of this record`,
    { object },
  );
}

/** Audit columns for a new row (`CreatedById` / `OwnerId`); null in system context. */
export function ownershipColumns(principal: Principal | undefined = currentPrincipal()): {
  ownerId: string | null;
  createdBy: string | null;
} {
  return { ownerId: principal?.sub ?? null, createdBy: principal?.sub ?? null };
}
