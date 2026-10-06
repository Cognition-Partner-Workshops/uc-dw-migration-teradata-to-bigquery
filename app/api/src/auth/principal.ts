import { GROUPS, type Group } from './policy';

/**
 * The authenticated caller, as the guard derives it from the bearer token. In Salesforce
 * terms: the running user (`UserInfo.getUserId()`) plus the permission sets assigned to
 * them (`cognito:groups`).
 */
export interface Principal {
  /** Stable user id (Cognito `sub`); stored in `owner_id` / `created_by` audit columns. */
  sub: string;
  username: string;
  email?: string;
  /** Cognito user-pool groups; the Dreamhouse ones map 1:1 to Salesforce permission sets. */
  groups: readonly string[];
}

export function isGroup(value: string): value is Group {
  return (GROUPS as readonly string[]).includes(value);
}

/** The Dreamhouse groups of a principal (unknown groups are ignored, like unrelated permission sets). */
export function dreamhouseGroups(principal: Pick<Principal, 'groups'>): Group[] {
  return principal.groups.filter(isGroup);
}
