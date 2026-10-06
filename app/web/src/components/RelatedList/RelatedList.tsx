import { Card, Center, Group, Loader, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';

/** `force:relatedListSingleContainer`: a card titled `Label (count)` around the related records. */
export function RelatedList({
  title,
  count,
  isPending,
  error,
  actions,
  children,
  'data-testid': testId = 'related-list',
}: {
  title: string;
  count?: number;
  isPending?: boolean;
  error?: unknown;
  actions?: ReactNode;
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <Card withBorder padding="md" data-testid={testId}>
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between" wrap="nowrap">
          <Title order={3} size="h5" data-testid={`${testId}-title`}>
            {title}
            {count !== undefined && (
              <Text component="span" c="dimmed" size="sm" ml={6}>
                ({count})
              </Text>
            )}
          </Title>
          {actions}
        </Group>
      </Card.Section>
      <Card.Section inheritPadding py="sm">
        {error ? (
          <ErrorPanel type="inlineMessage" friendlyMessage="Error retrieving data" errors={error} />
        ) : isPending ? (
          <Center py="md">
            <Loader size="sm" />
          </Center>
        ) : (
          children
        )}
      </Card.Section>
    </Card>
  );
}
