/**
 * Cognito user-pool groups of the Dreamhouse app — the Salesforce permission sets
 * (infra/modules/auth, app/api/src/auth/policy.ts). `dreamhouse` is the permission set of the
 * same name; `dreamhouse-admin` is the System Administrator superset (Settings, sample import).
 */
export const DREAMHOUSE_GROUP = 'dreamhouse';
export const ADMIN_GROUP = 'dreamhouse-admin';
export type DreamhouseGroup = typeof DREAMHOUSE_GROUP | typeof ADMIN_GROUP;

export function hasGroup(groups: readonly string[] | undefined, group: DreamhouseGroup): boolean {
  return (groups ?? []).includes(group);
}

/**
 * Groups of a stub (local development) user, derived from the username — the same rule the
 * API applies to `stub-token-for-<user>` (app/api/src/auth/auth.config.ts): `admin*` → both
 * groups, `guest*` → none (a user without the permission set), anything else → dreamhouse.
 */
export function stubGroups(username: string): string[] {
  const local = username.trim().toLowerCase().split('@')[0];
  if (local.startsWith('admin')) return [DREAMHOUSE_GROUP, ADMIN_GROUP];
  if (local.startsWith('guest')) return [];
  return [DREAMHOUSE_GROUP];
}
