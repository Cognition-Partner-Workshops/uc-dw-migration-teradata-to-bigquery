/**
 * Field mapping of a Salesforce object in the shape the record forms, highlights panels and
 * list views are generated from (docs/migration/mapping.yaml rows `field:<Object>.<Field>`).
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'url'
  | 'email'
  | 'phone'
  | 'picklist'
  | 'lookup'
  | 'image'
  | 'geolocation';

export interface LookupTarget {
  /** Salesforce object the lookup points to. */
  object: 'Broker__c';
  /** Record page route prefix (`navigateToRecord`). */
  route: '/brokers';
}

export interface FieldDef {
  /** API (camelCase) name; the key of the record DTO and of `output.fieldErrors`. */
  name: string;
  /** Salesforce field label (as the page layouts show it). */
  label: string;
  /** Salesforce API name the field is mapped from. */
  source: string;
  type: FieldType;
  required?: boolean;
  /** Formula / system fields the layouts mark `Readonly`. */
  readonly?: boolean;
  /** Restricted picklist values, in picklist order. */
  options?: readonly string[];
  lookup?: LookupTarget;
  /** `IMAGE()` formulas: the field holding the URL to render. */
  imageOf?: string;
  /** Geolocation compound: the two scalar fields it is stored in. */
  parts?: { latitude: string; longitude: string };
  /** Formula fields the API does not return: computed from the record. */
  derive?: (record: Record<string, unknown>) => unknown;
  /** Maximum fraction digits of a number. */
  maximumFractionDigits?: number;
}

/** `<layoutSections>` of a page layout / `flexipage:fieldSection`: label and columns of field names. */
export interface LayoutSection {
  label: string;
  columns: readonly (readonly string[])[];
}

/** One list-view / related-list column. */
export interface ListColumn {
  field: string;
  /** Render the value as the link to the record (the `NAME` column). */
  link?: boolean;
}

export type FieldMap = Record<string, FieldDef>;

/** The record DTO keys a field reads or writes (`geolocation` spans two). */
export function fieldKeys(field: FieldDef): string[] {
  return field.parts ? [field.parts.latitude, field.parts.longitude] : [field.name];
}

export function isEditable(field: FieldDef): boolean {
  return !field.readonly && field.type !== 'image' && !field.derive;
}

export function sectionFields(sections: readonly LayoutSection[]): string[] {
  return sections.flatMap((section) => section.columns.flat());
}
