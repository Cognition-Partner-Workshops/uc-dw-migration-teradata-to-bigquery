import type { FieldDef } from './fields';
import { fieldKeys } from './fields';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';

export type RecordValues = Record<string, unknown>;
/** Form state: one string per record key (`lightning-input` values). */
export type DraftValues = Record<string, string>;

/** Record value -> input string. */
export function toInputValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Input string -> record value, by field type (empty clears the field: `null`). */
export function fromInputValue(field: FieldDef, raw: string): unknown {
  const value = raw.trim();
  if (value === '') return null;
  switch (field.type) {
    case 'number':
    case 'currency':
    case 'geolocation': {
      const number = Number(value);
      return Number.isNaN(number) ? value : number;
    }
    default:
      return value;
  }
}

/** Initial drafts of every key the fields read (so Save can diff against them). */
export function draftsOf(
  fields: readonly FieldDef[],
  record: RecordValues | undefined,
): DraftValues {
  const drafts: DraftValues = {};
  for (const field of fields) {
    for (const key of fieldKeys(field)) {
      drafts[key] = toInputValue(record?.[key]);
    }
  }
  return drafts;
}

/**
 * The `updateRecord` payload: only the keys whose draft changed, typed by their field. With no
 * original record (create) every non-empty value is sent.
 */
export function changedValues(
  fields: readonly FieldDef[],
  drafts: DraftValues,
  original: DraftValues | undefined,
): RecordValues {
  const changes: RecordValues = {};
  for (const field of fields) {
    for (const key of fieldKeys(field)) {
      const draft = drafts[key] ?? '';
      if (original ? draft !== (original[key] ?? '') : draft.trim() !== '') {
        changes[key] = fromInputValue(field, draft);
      }
    }
  }
  return changes;
}

/** `lightning-input required`: "Complete this field." before the server is asked. */
export function missingRequired(fields: readonly FieldDef[], drafts: DraftValues): string[] {
  return fields
    .filter((field) => field.required && (drafts[field.name] ?? '').trim() === '')
    .map((field) => field.name);
}

/** The display text of a field value (`lightning-output-field`), without the link/image rendering. */
export function formatFieldValue(field: FieldDef, record: RecordValues): string {
  const value = field.derive ? field.derive(record) : record[field.name];
  switch (field.type) {
    case 'currency':
      return formatCurrency(value as number | null);
    case 'number':
      return formatNumber(value as number | null, field.maximumFractionDigits);
    case 'date':
      return formatDate(value as string | null);
    case 'datetime':
      return formatDateTime(value as string | null);
    case 'geolocation': {
      const latitude = record[field.parts!.latitude];
      const longitude = record[field.parts!.longitude];
      return latitude === null || latitude === undefined || longitude === null
        ? ''
        : `${formatNumber(latitude as number, 6)}, ${formatNumber(longitude as number, 6)}`;
    }
    default:
      return toInputValue(value);
  }
}
