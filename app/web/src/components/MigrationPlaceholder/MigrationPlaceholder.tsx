import { Alert, Code, Group, List, Paper, Stack, Text } from '@mantine/core';
import { IconArrowsExchange } from '@tabler/icons-react';

export interface SalesforceSource {
  /** Component / page / class name in salesforce/force-app. */
  name: string;
  /** What kind of artifact it is (LWC, flexipage, flow, Apex, …). */
  kind: string;
}

/**
 * Marks a page whose Salesforce behaviour is not ported yet: lists the source artifacts it
 * replaces and the ticket that ports them, so the shell is navigable end to end before the
 * feature work lands (same role as the API's 501 stubs).
 */
export function MigrationPlaceholder({
  sources,
  ticket,
  children,
}: {
  sources: SalesforceSource[];
  ticket: string;
  children?: React.ReactNode;
}) {
  return (
    <Stack gap="md">
      {children}
      <Alert
        variant="light"
        color="gray"
        icon={<IconArrowsExchange size={18} />}
        title={`Not ported yet — ticket ${ticket}`}
        data-testid="migration-placeholder"
      >
        <Text size="sm" mb="xs">
          This page replaces the following Salesforce artifacts:
        </Text>
        <Paper withBorder p="xs" bg="var(--mantine-color-body)">
          <List size="sm" spacing={4}>
            {sources.map((source) => (
              <List.Item key={`${source.kind}:${source.name}`}>
                <Group gap={6} wrap="nowrap">
                  <Code>{source.name}</Code>
                  <Text size="xs" c="dimmed">
                    {source.kind}
                  </Text>
                </Group>
              </List.Item>
            ))}
          </List>
        </Paper>
      </Alert>
    </Stack>
  );
}
