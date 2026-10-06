/**
 * Object-level, Apex-class and app access of the Salesforce permission set `dreamhouse`
 * (salesforce/force-app/main/default/permissionsets/dreamhouse.permissionset-meta.xml),
 * expressed per Cognito group. `policy.spec.ts` parses that XML and asserts this table
 * matches it entry for entry, except for the rows listed in `DEVIATIONS`.
 *
 * Group → Salesforce counterpart:
 *   dreamhouse        the permission set on a Standard User profile (TestPropertyController lines 28-53)
 *   dreamhouse-admin  System Administrator profile (View All Data / Modify All Data, Author Apex)
 *
 * Keys referenced from controllers (`@RequirePermission`) and docs/migration/mapping.yaml:
 *   app.access                  permission:dreamhouse.application.Dreamhouse
 *   <resource>.<operation>      permission:dreamhouse.object.<Object>   (policy.<resource>.crud)
 *   <resource>.invoke           permission:dreamhouse.apexClass.<Class> (policy.<resource>.invoke)
 */

export const GROUPS = ['dreamhouse', 'dreamhouse-admin'] as const;
export type Group = (typeof GROUPS)[number];

export const SF_OBJECTS = ['Property__c', 'Broker__c', 'Contact', 'ContentDocument'] as const;
export type SfObject = (typeof SF_OBJECTS)[number];

export const OPERATIONS = ['create', 'read', 'edit', 'delete'] as const;
export type Operation = (typeof OPERATIONS)[number];

/** `<objectPermissions>` of a permission set / profile. */
export interface ObjectGrant {
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
  /** "View All": read every record regardless of sharing. */
  viewAllRecords: boolean;
  /** "Modify All": edit/delete every record regardless of sharing. */
  modifyAllRecords: boolean;
}

const FULL_ACCESS: ObjectGrant = {
  create: true,
  read: true,
  edit: true,
  delete: true,
  viewAllRecords: true,
  modifyAllRecords: true,
};
const OWN_RECORDS_CRUD: ObjectGrant = {
  ...FULL_ACCESS,
  viewAllRecords: false,
  modifyAllRecords: false,
};
const NO_ACCESS: ObjectGrant = {
  create: false,
  read: false,
  edit: false,
  delete: false,
  viewAllRecords: false,
  modifyAllRecords: false,
};

/** API resource (first segment of the permission keys and routes) per Salesforce object. */
export const OBJECT_RESOURCES = {
  Property__c: 'properties',
  Broker__c: 'brokers',
  Contact: 'contacts',
  ContentDocument: 'files',
} as const satisfies Record<SfObject, string>;
export type ObjectResource = (typeof OBJECT_RESOURCES)[SfObject];

export const OBJECT_PERMISSIONS: Record<Group, Record<SfObject, ObjectGrant>> = {
  dreamhouse: {
    // <objectPermissions> Property__c / Broker__c: allowCreate/Read/Edit/Delete + viewAllRecords + modifyAllRecords
    Property__c: FULL_ACCESS,
    Broker__c: FULL_ACCESS,
    // Not in the permission set: the Standard User profile baseline the sample data relied on
    // (Contact CRUD, file upload); no View All / Modify All, so sharing applies (sharing.ts).
    Contact: OWN_RECORDS_CRUD,
    ContentDocument: OWN_RECORDS_CRUD,
  },
  'dreamhouse-admin': {
    Property__c: FULL_ACCESS,
    Broker__c: FULL_ACCESS,
    Contact: FULL_ACCESS,
    ContentDocument: FULL_ACCESS,
  },
};

export const APEX_CLASSES = [
  'PropertyController',
  'PagedResult',
  'SampleDataController',
  'FileUtilities',
  'GeocodingService',
] as const;
export type ApexClass = (typeof APEX_CLASSES)[number];

/** API resource whose `.invoke` permission stands for access to the class. */
export const CLASS_RESOURCES = {
  PropertyController: 'properties',
  PagedResult: 'properties',
  SampleDataController: 'sampleData',
  FileUtilities: 'files',
  GeocodingService: 'geocoding',
} as const satisfies Record<ApexClass, string>;
export type ClassResource = (typeof CLASS_RESOURCES)[ApexClass];

/**
 * `<classAccesses>` — a Lightning component may only call `@AuraEnabled` methods of classes
 * the user has access to. Invocable actions run from a flow (GeocodingService) need none.
 */
export const CLASS_ACCESS: Record<Group, Record<ApexClass, boolean>> = {
  dreamhouse: {
    PropertyController: true,
    PagedResult: true,
    SampleDataController: false, // see DEVIATIONS
    FileUtilities: false, // not granted by the permission set (upstream gap; kept as-is)
    GeocodingService: true, // flow action, no class access required
  },
  'dreamhouse-admin': {
    PropertyController: true,
    PagedResult: true,
    SampleDataController: true,
    FileUtilities: true,
    GeocodingService: true,
  },
};

/** `<applicationVisibilities>` Dreamhouse: who may use the app at all (web sign-in, any API call). */
export const APP_ACCESS: Record<Group, boolean> = {
  dreamhouse: true,
  'dreamhouse-admin': true,
};

/**
 * Where this table deliberately differs from the permission set. Everything not listed here
 * must match the XML (policy.spec.ts). Each entry is also recorded in docs/migration/mapping.yaml.
 */
export const DEVIATIONS: readonly {
  subject: string;
  group: Group;
  salesforce: string;
  api: string;
  reason: string;
}[] = [
  {
    subject: 'apexClass.SampleDataController',
    group: 'dreamhouse',
    salesforce: 'enabled',
    api: 'denied (dreamhouse-admin only)',
    reason:
      'importSampleData deletes every Property__c, Broker__c and Contact first; in the org only the ' +
      'administrator used it from the Settings tab. Mapping decision (mapping.yaml apexClass:SampleDataController, ' +
      'tab Settings): admin-only, like the System Administrator profile.',
  },
  {
    subject: 'apexClass.GeocodingService',
    group: 'dreamhouse',
    salesforce: 'not granted (invocable action run by the Create_property flow)',
    api: 'allowed',
    reason:
      'A flow runs an @InvocableMethod without class access; the flow itself was reachable by every ' +
      'app user. POST /geocoding/addresses is therefore open to the dreamhouse group.',
  },
];

export type PermissionKey =
  'app.access' | `${ObjectResource}.${Operation}` | `${ClassResource}.invoke`;

function objectKey(object: SfObject, operation: Operation): PermissionKey {
  return `${OBJECT_RESOURCES[object]}.${operation}`;
}

function classKey(apexClass: ApexClass): PermissionKey {
  return `${CLASS_RESOURCES[apexClass]}.invoke`;
}

/** Flattened matrix: permission key → groups that hold it (derived from the tables above). */
export const PERMISSIONS: Readonly<Record<PermissionKey, readonly Group[]>> = (() => {
  const matrix = new Map<PermissionKey, Group[]>();
  const grant = (key: PermissionKey, group: Group) => {
    const groups = matrix.get(key) ?? [];
    if (!groups.includes(group)) groups.push(group);
    matrix.set(key, groups);
  };
  for (const group of GROUPS) {
    if (APP_ACCESS[group]) grant('app.access', group);
    for (const object of SF_OBJECTS) {
      for (const operation of OPERATIONS) {
        matrix.set(objectKey(object, operation), matrix.get(objectKey(object, operation)) ?? []);
        if (OBJECT_PERMISSIONS[group][object][operation])
          grant(objectKey(object, operation), group);
      }
    }
    for (const apexClass of APEX_CLASSES) {
      matrix.set(classKey(apexClass), matrix.get(classKey(apexClass)) ?? []);
      if (CLASS_ACCESS[group][apexClass]) grant(classKey(apexClass), group);
    }
  }
  return Object.fromEntries(matrix) as unknown as Record<PermissionKey, readonly Group[]>;
})();

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/** Groups that hold `key` (what a 403 reports as `requiredGroups`). */
export function requiredGroups(key: PermissionKey): readonly Group[] {
  return PERMISSIONS[key];
}

/** True when any of the caller's groups holds `key`. */
export function isPermitted(groups: readonly string[], key: PermissionKey): boolean {
  return PERMISSIONS[key].some((group) => groups.includes(group));
}

/** The effective object grant of a caller: the union of their groups' grants (as Salesforce unions permission sets). */
export function effectiveObjectGrant(groups: readonly string[], object: SfObject): ObjectGrant {
  const grant: ObjectGrant = { ...NO_ACCESS };
  for (const group of GROUPS) {
    if (!groups.includes(group)) continue;
    for (const flag of Object.keys(grant) as (keyof ObjectGrant)[]) {
      grant[flag] = grant[flag] || OBJECT_PERMISSIONS[group][object][flag];
    }
  }
  return grant;
}
