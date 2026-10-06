import {
  ActionIcon,
  Anchor,
  Card,
  Center,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconArrowsMaximize } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { brokerQuery, propertyQuery } from '@/api/queries';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { formatCurrency } from '@/lib/format';
import { useSelectedProperty } from '@/state/selectedProperty';

function Field({
  label,
  value,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  testId: string;
}) {
  return (
    <Stack gap={0} data-testid={testId}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" component="div">
        {value}
      </Text>
    </Stack>
  );
}

/**
 * Port of `c/propertySummary`: name, picture and the Beds / Baths / Price / Broker record form of
 * the selected property (subscribes `PropertySelected` via the `selected` URL param), with the
 * "Navigate to Record" action; empty and error states keep the LWC messages.
 *
 * LDS `getRecord` becomes GET /properties/{id}; the `Broker__c` lookup the record form rendered
 * is resolved with GET /brokers/{id}. While the record loads, the `PropertySummaryDto` the list
 * or map already holds for that id (selectedProperty store) stands in, so a tile or marker click
 * paints immediately as on Salesforce (LDS cache).
 */
export function PropertySummary() {
  const navigate = useNavigate();
  const { propertyId, property: rememberedProperty } = useSelectedProperty();
  const recordQuery = useQuery(propertyQuery(propertyId ?? ''));
  const record = recordQuery.data;
  const brokerId = record?.brokerId ?? '';
  const broker = useQuery(brokerQuery(brokerId));

  const property = record ?? rememberedProperty;
  const hasNoPropertyId = !propertyId;
  const error = recordQuery.error ?? undefined;

  const brokerValue = !record ? (
    ''
  ) : !record.brokerId ? (
    '—'
  ) : broker.data ? (
    <Anchor
      component={Link}
      to={`/brokers/${broker.data.id}`}
      size="sm"
      data-testid="property-summary-broker-link"
    >
      {broker.data.name}
    </Anchor>
  ) : broker.isError ? (
    '—'
  ) : (
    '…'
  );

  return (
    <Card
      withBorder
      padding="md"
      data-testid="property-summary"
      data-property-id={propertyId ?? ''}
    >
      {property && !error && (
        <>
          <Card.Section withBorder inheritPadding py="xs">
            <Group justify="space-between" wrap="nowrap">
              <Title order={3} size="h5" lineClamp={1} data-testid="property-summary-name">
                {property.name}
              </Title>
              <ActionIcon
                variant="subtle"
                aria-label="Navigate to Record"
                onClick={() => navigate(`/properties/${property.id}`)}
                data-testid="property-summary-navigate"
              >
                <IconArrowsMaximize size={18} />
              </ActionIcon>
            </Group>
          </Card.Section>
          <Stack gap="sm" mt="md">
            <Image
              src={record?.picture ?? property.thumbnail ?? undefined}
              alt="Property picture"
              radius="sm"
              fit="cover"
              h={160}
              data-testid="property-summary-picture"
            />
            <SimpleGrid cols={2} spacing="sm" data-testid="property-summary-form">
              <Field label="Beds" value={property.beds} testId="property-summary-beds" />
              <Field label="Baths" value={property.baths} testId="property-summary-baths" />
              <Field
                label="Price"
                value={formatCurrency(property.price)}
                testId="property-summary-price"
              />
              <Field label="Broker" value={brokerValue} testId="property-summary-broker" />
            </SimpleGrid>
          </Stack>
        </>
      )}
      {hasNoPropertyId && <ErrorPanel friendlyMessage="Select a property to see details" />}
      {error && <ErrorPanel friendlyMessage="Error retrieving data" errors={error} />}
      {propertyId && !property && !error && (
        <Center py="xl" data-testid="property-summary-loading">
          <Loader size="sm" />
        </Center>
      )}
    </Card>
  );
}
