/**
 * Field-level security of the permission set `dreamhouse` (`<fieldPermissions>`), keyed by
 * the API field names the DTOs use. Applied in two places:
 *   - responses: `stripUnreadable` removes fields the caller may not read (FieldSecurityInterceptor);
 *   - request bodies: `assertWritable` rejects fields the caller may not edit with 403
 *     (Salesforce: INVALID_FIELD_FOR_INSERT_UPDATE on DML, the field being read-only in the UI).
 * `policy.spec.ts` asserts this list matches the XML field for field.
 */
import { ERROR_CODES, FieldErrorDto } from '../common/errors/api-error.dto';
import { InsufficientAccessException } from './auth.exceptions';
import { type Group, type SfObject } from './policy';

export interface FieldRule {
  object: SfObject;
  /** `<field>` of the permission set (Object.Field__c). */
  sfField: string;
  /** API (DTO) field name(s) the Salesforce field maps to; compound fields map to several. */
  fields: readonly string[];
  readable: boolean;
  editable: boolean;
  /** Formula / derived: nobody can write it, whatever their group. */
  formula?: boolean;
}

const rw = (object: SfObject, sfField: string, ...fields: string[]): FieldRule => ({
  object,
  sfField,
  fields,
  readable: true,
  editable: true,
});
const formula = (object: SfObject, sfField: string, ...fields: string[]): FieldRule => ({
  object,
  sfField,
  fields,
  readable: true,
  editable: false,
  formula: true,
});

/** `<fieldPermissions>` of dreamhouse.permissionset-meta.xml, in file order. */
export const FIELD_PERMISSIONS: readonly FieldRule[] = [
  rw('Broker__c', 'Broker__c.Broker_Id__c', 'brokerId'),
  rw('Broker__c', 'Broker__c.Email__c', 'email'),
  rw('Broker__c', 'Broker__c.Mobile_Phone__c', 'mobilePhone'),
  rw('Broker__c', 'Broker__c.Phone__c', 'phone'),
  formula('Broker__c', 'Broker__c.Picture_IMG__c', 'pictureImg'),
  rw('Broker__c', 'Broker__c.Picture__c', 'picture'),
  rw('Broker__c', 'Broker__c.Title__c', 'title'),
  rw('Property__c', 'Property__c.Address__c', 'address'),
  rw('Property__c', 'Property__c.Assessed_Value__c', 'assessedValue'),
  rw('Property__c', 'Property__c.Baths__c', 'baths'),
  rw('Property__c', 'Property__c.Beds__c', 'beds'),
  rw('Property__c', 'Property__c.Broker__c', 'brokerId'),
  rw('Property__c', 'Property__c.City__c', 'city'),
  rw('Property__c', 'Property__c.Date_Agreement__c', 'dateAgreement'),
  rw('Property__c', 'Property__c.Date_Closed__c', 'dateClosed'),
  rw('Property__c', 'Property__c.Date_Contracted__c', 'dateContracted'),
  rw('Property__c', 'Property__c.Date_Listed__c', 'dateListed'),
  rw('Property__c', 'Property__c.Date_Pre_Market__c', 'datePreMarket'),
  formula('Property__c', 'Property__c.Days_On_Market__c', 'daysOnMarket'),
  rw('Property__c', 'Property__c.Description__c', 'description'),
  rw('Property__c', 'Property__c.Location__c', 'latitude', 'longitude'),
  rw('Property__c', 'Property__c.Name', 'name'),
  formula('Property__c', 'Property__c.Picture_IMG__c', 'pictureImg'),
  rw('Property__c', 'Property__c.Picture__c', 'picture'),
  rw('Property__c', 'Property__c.Price_Sold__c', 'priceSold'),
  rw('Property__c', 'Property__c.Price__c', 'price'),
  formula('Property__c', 'Property__c.Record_Link__c', 'recordLink'),
  rw('Property__c', 'Property__c.State__c', 'state'),
  rw('Property__c', 'Property__c.Status__c', 'status'),
  rw('Property__c', 'Property__c.Tags__c', 'tags'),
  formula('Property__c', 'Property__c.Thumbnail_IMG__c', 'thumbnailImg'),
  rw('Property__c', 'Property__c.Thumbnail__c', 'thumbnail'),
  rw('Property__c', 'Property__c.Zip__c', 'zip'),
];

/**
 * Fields outside field-level security: record id, the standard Name field (Broker__c; the
 * permission set lists Property__c.Name explicitly), system audit fields and the migration
 * column. Always readable; `name` writable with object edit access.
 */
export const SYSTEM_FIELDS: readonly string[] = ['id', 'sfId', 'name', 'createdAt', 'updatedAt'];

export interface FieldAccess {
  readable: ReadonlySet<string>;
  editable: ReadonlySet<string>;
  /** Fields under FLS for the object (every API name that appears in FIELD_PERMISSIONS). */
  controlled: ReadonlySet<string>;
}

/** Groups whose field access is the permission set; `dreamhouse-admin` sees and edits every non-formula field. */
function grantsFields(groups: readonly string[]): { all: boolean; permissionSet: boolean } {
  return {
    all: groups.includes('dreamhouse-admin' satisfies Group),
    permissionSet: groups.includes('dreamhouse' satisfies Group),
  };
}

/** The readable / editable API fields of `object` for a caller with `groups`. */
export function fieldAccess(groups: readonly string[], object: SfObject): FieldAccess {
  const { all, permissionSet } = grantsFields(groups);
  const readable = new Set<string>();
  const editable = new Set<string>();
  const controlled = new Set<string>();
  for (const rule of FIELD_PERMISSIONS) {
    if (rule.object !== object) continue;
    for (const field of rule.fields) {
      controlled.add(field);
      if (all || (permissionSet && rule.readable)) readable.add(field);
      if (!rule.formula && (all || (permissionSet && rule.editable))) editable.add(field);
    }
  }
  return { readable, editable, controlled };
}

type Payload = Record<string, unknown>;

function stripRecord(record: Payload, access: FieldAccess): Payload {
  const out: Payload = {};
  for (const [key, value] of Object.entries(record)) {
    if (access.controlled.has(key) && !access.readable.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Removes the fields the caller may not read from a record, an array of records or a
 * PagedResult (`{ records: [...] }`). Keys that are not under FLS (system fields, computed
 * values such as picture URLs) pass through.
 */
export function stripUnreadable<T>(payload: T, groups: readonly string[], object: SfObject): T {
  const access = fieldAccess(groups, object);
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const record = value as Payload;
      if (Array.isArray(record.records)) return { ...record, records: strip(record.records) };
      return stripRecord(record, access);
    }
    return value;
  };
  return strip(payload) as T;
}

/** The body fields the caller may not write (present, under FLS, not editable for them). */
export function unwritableFields(
  body: unknown,
  groups: readonly string[],
  object: SfObject,
): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const access = fieldAccess(groups, object);
  return Object.keys(body as Payload).filter(
    (key) => access.controlled.has(key) && !access.editable.has(key),
  );
}

/** 403 when the body writes a field the caller's groups cannot edit (read-only or hidden). */
export function assertWritable(body: unknown, groups: readonly string[], object: SfObject): void {
  const denied = unwritableFields(body, groups, object);
  if (denied.length === 0) return;
  const fieldErrors: FieldErrorDto[] = denied.map((field) => ({
    field,
    errorCode: ERROR_CODES.invalidFieldForInsertUpdate,
    message: `${field} is not editable by your groups`,
  }));
  throw new InsufficientAccessException(`Unable to create/update fields: ${denied.join(', ')}`, {
    object,
    fieldErrors,
  });
}
