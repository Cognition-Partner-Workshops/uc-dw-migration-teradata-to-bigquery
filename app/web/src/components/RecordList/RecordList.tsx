import { Anchor, Table, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { FieldMap, ListColumn } from '@/records/fields';
import { RecordFieldValue } from '@/components/RecordFieldValue/RecordFieldValue';
import { formatFieldValue, type RecordValues } from '@/records/values';

/**
 * The table of a list view / related list: one column per `ListColumn` (labels from the field
 * mapping), the `NAME` column linking to the record page (`navigateToRecord`).
 */
export function RecordList<T extends RecordValues & { id: string }>({
  fields,
  columns,
  records,
  recordRoute,
  emptyMessage = 'No items to display.',
  'data-testid': testId = 'record-list',
}: {
  fields: FieldMap;
  columns: readonly ListColumn[];
  records: readonly T[];
  recordRoute: (record: T) => string;
  emptyMessage?: string;
  'data-testid'?: string;
}) {
  return (
    <Table striped highlightOnHover withTableBorder data-testid={testId}>
      <Table.Thead>
        <Table.Tr>
          {columns.map((column) => (
            <Table.Th key={column.field}>{fields[column.field].label}</Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {records.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={columns.length}>
              <Text size="sm" c="dimmed" ta="center" py="md" data-testid={`${testId}-empty`}>
                {emptyMessage}
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {records.map((record) => (
          <Table.Tr key={record.id} data-testid={`${testId}-row`} data-record-id={record.id}>
            {columns.map((column) => {
              const field = fields[column.field];
              return (
                <Table.Td key={column.field} data-field={field.source}>
                  {column.link ? (
                    <Anchor
                      component={Link}
                      to={recordRoute(record)}
                      size="sm"
                      fw={500}
                      data-testid={`${testId}-link`}
                    >
                      {formatFieldValue(field, record)}
                    </Anchor>
                  ) : (
                    <RecordFieldValue field={field} record={record} />
                  )}
                </Table.Td>
              );
            })}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
