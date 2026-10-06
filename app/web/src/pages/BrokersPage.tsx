import { Button, Group, Paper, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateBroker } from '@/api/mutations';
import { brokersQuery } from '@/api/queries';
import type { CreateBrokerDto } from '@/api/types';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { RecordModal } from '@/components/RecordForm/RecordModal';
import { RecordList } from '@/components/RecordList/RecordList';
import {
  BROKER_FIELDS,
  BROKER_LAYOUT_SECTIONS,
  BROKER_OBJECT,
  brokerRoute,
} from '@/pages/brokers/brokerLayout';
import { BROKER_LIST_VIEW } from '@/pages/brokers/brokerListView';

const CREATE_SECTIONS = BROKER_LAYOUT_SECTIONS.filter(
  (section) => section.label !== 'System Information',
);

/** `tab:Broker__c` -> `listView:Broker__c.All` (Name) + the New action. */
export function BrokersPage() {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const brokers = useQuery(brokersQuery);
  const create = useCreateBroker();

  return (
    <>
      <PageHeader
        title={BROKER_OBJECT.labelPlural}
        subtitle={`${BROKER_LIST_VIEW.label} • ${brokers.data?.length ?? '…'} items`}
        actions={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreating(true)}
            data-testid="record-action-new"
          >
            New
          </Button>
        }
      />
      <Paper
        withBorder
        p="sm"
        data-testid="brokers-list-view"
        data-list-view={BROKER_LIST_VIEW.apiName}
      >
        {brokers.data && (
          <RecordList
            fields={BROKER_FIELDS}
            columns={BROKER_LIST_VIEW.columns}
            records={brokers.data}
            recordRoute={(broker) => brokerRoute(broker.id)}
            data-testid="brokers-list"
          />
        )}
        {brokers.isError && (
          <ErrorPanel friendlyMessage="Error retrieving data" errors={brokers.error} />
        )}
        {brokers.isPending && (
          <Group justify="center" py="xl">
            <Text size="sm" c="dimmed" data-testid="brokers-list-loading">
              Loading…
            </Text>
          </Group>
        )}
      </Paper>
      <RecordModal
        opened={creating}
        onClose={() => setCreating(false)}
        title={`New ${BROKER_OBJECT.label}`}
        fields={BROKER_FIELDS}
        sections={CREATE_SECTIONS}
        onSubmit={async (values) => {
          const created = await create.mutateAsync({
            ...(values as Omit<CreateBrokerDto, 'name'>),
            name: String(values.name),
          });
          navigate(brokerRoute(created.id));
        }}
        data-testid="broker-create-form"
      />
    </>
  );
}
