import { Anchor, Image, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { brokerQuery } from '@/api/queries';
import type { FieldDef } from '@/records/fields';
import { formatFieldValue, type RecordValues } from '@/records/values';

/** `lightning-output-field` on a `Broker__c` lookup: the broker name linking to its record page. */
function LookupValue({ field, recordId }: { field: FieldDef; recordId: string }) {
  const broker = useQuery(brokerQuery(recordId));
  return (
    <Anchor
      component={Link}
      to={`${field.lookup!.route}/${recordId}`}
      size="sm"
      data-testid={`field-${field.name}-link`}
    >
      {broker.data?.name ?? (broker.isError ? recordId : '…')}
    </Anchor>
  );
}

/** Read-only rendering of one field of a record, by field type. */
export function RecordFieldValue({ field, record }: { field: FieldDef; record: RecordValues }) {
  const raw = field.derive ? field.derive(record) : record[field.name];

  if (field.type === 'image') {
    const url = record[field.imageOf ?? field.name] as string | null | undefined;
    return url ? (
      <Image src={url} alt={field.label} w={150} h={100} fit="cover" radius="sm" />
    ) : (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  if (field.type === 'lookup') {
    return typeof raw === 'string' && raw.length > 0 ? (
      <LookupValue field={field} recordId={raw} />
    ) : (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  if (field.type === 'url' && typeof raw === 'string' && raw.length > 0) {
    return (
      <Anchor href={raw} target="_blank" rel="noreferrer" size="sm" lineClamp={1}>
        {raw}
      </Anchor>
    );
  }
  if (field.type === 'email' && typeof raw === 'string' && raw.length > 0) {
    return (
      <Anchor href={`mailto:${raw}`} size="sm">
        {raw}
      </Anchor>
    );
  }
  if (field.type === 'phone' && typeof raw === 'string' && raw.length > 0) {
    return (
      <Anchor href={`tel:${raw}`} size="sm">
        {raw}
      </Anchor>
    );
  }
  const text = formatFieldValue(field, record);
  return (
    <Text size="sm" style={{ whiteSpace: field.type === 'textarea' ? 'pre-wrap' : undefined }}>
      {text === '' ? <span style={{ color: 'var(--mantine-color-dimmed)' }}>—</span> : text}
    </Text>
  );
}
