import { ActionIcon, Card, Center, Group, Loader, Text, Title, Tooltip } from '@mantine/core';
import { IconArrowsMaximize } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useUpdateBroker } from '@/api/mutations';
import { brokerQuery, propertyQuery } from '@/api/queries';
import type { UpdateBrokerDto } from '@/api/types';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { RecordForm } from '@/components/RecordForm/RecordForm';
import { BROKER_CARD_SECTIONS, BROKER_FIELDS, brokerRoute } from '@/pages/brokers/brokerLayout';

function BrokerRecordForm({ brokerId }: { brokerId: string }) {
  const broker = useQuery(brokerQuery(brokerId));
  const update = useUpdateBroker(brokerId);

  if (broker.isPending) {
    return (
      <Center py="md" data-testid="broker-card-loading">
        <Loader size="sm" />
      </Center>
    );
  }
  if (broker.isError) {
    return <ErrorPanel friendlyMessage="Error retrieving data" errors={broker.error} />;
  }
  return (
    <RecordForm
      fields={BROKER_FIELDS}
      sections={BROKER_CARD_SECTIONS}
      record={broker.data}
      density="compact"
      onSubmit={(changes) => update.mutateAsync(changes as UpdateBrokerDto)}
      data-testid="broker-card-form"
    />
  );
}

/**
 * Port of `c/brokerCard`: reads `Property__c.Broker__c` of the record and renders a
 * `lightning-record-form` (Name, Phone, Mobile Phone, Email, 2 columns, inline edit) for that
 * broker, with the "Navigate to record" action (`standard__recordPage` -> `/brokers/:id`).
 */
export function BrokerCard({ propertyId }: { propertyId: string }) {
  const property = useQuery(propertyQuery(propertyId));
  const navigate = useNavigate();
  const brokerId = property.data?.brokerId ?? null;

  return (
    <Card withBorder padding="md" data-testid="broker-card" data-broker-id={brokerId ?? ''}>
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between" wrap="nowrap">
          <Title order={3} size="h5">
            Broker
          </Title>
          {brokerId && (
            <Tooltip label="Navigate to record">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Navigate to record"
                onClick={() => navigate(brokerRoute(brokerId))}
                data-testid="broker-card-navigate"
              >
                <IconArrowsMaximize size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Card.Section>
      <Card.Section inheritPadding py="md">
        {property.isPending && (
          <Center py="md" data-testid="broker-card-loading">
            <Loader size="sm" />
          </Center>
        )}
        {property.isError && (
          <ErrorPanel friendlyMessage="Error retrieving data" errors={property.error} />
        )}
        {property.data &&
          (brokerId ? (
            <BrokerRecordForm brokerId={brokerId} />
          ) : (
            <Text size="sm" c="dimmed" data-testid="broker-card-empty">
              No broker is assigned to this property.
            </Text>
          ))}
      </Card.Section>
    </Card>
  );
}
