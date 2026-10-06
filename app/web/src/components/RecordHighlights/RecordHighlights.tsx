import { Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import type { FieldMap } from '@/records/fields';
import { RecordFieldValue } from '@/components/RecordFieldValue/RecordFieldValue';
import type { RecordValues } from '@/records/values';

/**
 * `force:highlightsPanel`: object label, record name and the compact-layout fields, with the
 * record actions (Edit, Delete, ...) on the right.
 */
export function RecordHighlights({
  objectLabel,
  icon,
  fields,
  highlights,
  record,
  actions,
}: {
  objectLabel: string;
  icon: ReactNode;
  fields: FieldMap;
  /** Compact layout fields; the first one is the record name shown as the title. */
  highlights: readonly string[];
  record: RecordValues;
  actions?: ReactNode;
}) {
  const [nameField, ...detailFields] = highlights;
  return (
    <Paper withBorder p="md" data-testid="record-highlights">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Group align="flex-start" wrap="nowrap" gap="sm">
          <ThemeIcon size={40} radius="md" color="dreamhouse" variant="filled">
            {icon}
          </ThemeIcon>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              {objectLabel}
            </Text>
            <Title order={2} size="h3" data-testid="record-highlights-name">
              {String(record[nameField] ?? '')}
            </Title>
          </Stack>
        </Group>
        {actions && (
          <Group gap="xs" data-testid="record-highlights-actions">
            {actions}
          </Group>
        )}
      </Group>
      <Group gap="xl" mt="md" wrap="wrap" data-testid="record-highlights-fields">
        {detailFields.map((name) => (
          <Stack
            gap={0}
            key={name}
            data-testid={`highlight-${name}`}
            data-field={fields[name].source}
          >
            <Text size="xs" c="dimmed">
              {fields[name].label}
            </Text>
            <RecordFieldValue field={fields[name]} record={record} />
          </Stack>
        ))}
      </Group>
    </Paper>
  );
}
