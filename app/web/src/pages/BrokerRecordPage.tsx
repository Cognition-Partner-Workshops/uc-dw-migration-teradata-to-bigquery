import { Button, Center, Grid, Loader, Paper, Stack, Tabs } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDeleteBroker, useUpdateBroker } from '@/api/mutations';
import { brokerQuery, propertiesQuery } from '@/api/queries';
import type { UpdateBrokerDto } from '@/api/types';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { DeleteRecordButton } from '@/components/RecordForm/DeleteRecordButton';
import { RecordForm } from '@/components/RecordForm/RecordForm';
import { RecordModal } from '@/components/RecordForm/RecordModal';
import { RecordHighlights } from '@/components/RecordHighlights/RecordHighlights';
import { RecordList } from '@/components/RecordList/RecordList';
import { RelatedList } from '@/components/RelatedList/RelatedList';
import {
  BROKER_DETAIL_SECTIONS,
  BROKER_FIELDS,
  BROKER_HIGHLIGHTS,
  BROKER_LAYOUT_SECTIONS,
  BROKER_OBJECT,
} from '@/pages/brokers/brokerLayout';
import {
  BROKER_PROPERTIES_COLUMNS,
  PROPERTY_FIELDS,
  propertyRoute,
} from '@/pages/properties/propertyLayout';

/** `rowsToDisplay=10` of the `Properties__r` related list. */
export const RELATED_PROPERTIES_ROWS = 10;

/** `force:relatedListSingleContainer` `Properties__r`: GET /properties?brokerId=... */
function BrokerPropertiesRelatedList({ brokerId }: { brokerId: string }) {
  const properties = useQuery(
    propertiesQuery({ brokerId, pageSize: RELATED_PROPERTIES_ROWS, pageNumber: 1 }),
  );
  return (
    <RelatedList
      title="Properties"
      count={properties.data?.totalItemCount}
      isPending={properties.isPending}
      error={properties.error}
      data-testid="broker-properties"
    >
      {properties.data && (
        <RecordList
          fields={PROPERTY_FIELDS}
          columns={BROKER_PROPERTIES_COLUMNS}
          records={properties.data.records}
          recordRoute={(property) => propertyRoute(property.id)}
          data-testid="broker-properties-list"
        />
      )}
    </RelatedList>
  );
}

/**
 * `flexipages/Broker_Record_Page` (`recordHomeTemplateDesktop`): highlights panel, the main
 * tabset (Related | Details) and the `Properties__r` related list in the sidebar.
 */
export function BrokerRecordPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const broker = useQuery(brokerQuery(id));
  const update = useUpdateBroker(id);
  const remove = useDeleteBroker();
  const [editing, setEditing] = useState(false);

  if (broker.isPending) {
    return (
      <Center py="xl" data-testid="broker-record-loading">
        <Loader />
      </Center>
    );
  }
  if (broker.isError) {
    return (
      <Paper withBorder p="md">
        <ErrorPanel friendlyMessage="Error retrieving data" errors={broker.error} />
      </Paper>
    );
  }
  const record = broker.data;
  const save = (changes: Record<string, unknown>) => update.mutateAsync(changes as UpdateBrokerDto);

  return (
    <Stack gap="md" data-testid="broker-record-page" data-record-id={record.id}>
      <RecordHighlights
        objectLabel={BROKER_OBJECT.label}
        icon={<IconUser size={24} />}
        fields={BROKER_FIELDS}
        highlights={BROKER_HIGHLIGHTS}
        record={record}
        actions={
          <>
            <Button
              variant="default"
              onClick={() => setEditing(true)}
              data-testid="record-action-edit"
            >
              Edit
            </Button>
            <DeleteRecordButton
              objectLabel={BROKER_OBJECT.label}
              recordName={record.name}
              onDelete={() => remove.mutateAsync(record.id)}
              onDeleted={() => navigate(BROKER_OBJECT.route)}
            />
          </>
        }
      />
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder p="md" data-testid="record-main">
            <Tabs defaultValue="details" keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="related">Related</Tabs.Tab>
                <Tabs.Tab value="details">Details</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="related" pt="md">
                <BrokerPropertiesRelatedList brokerId={record.id} />
              </Tabs.Panel>
              <Tabs.Panel value="details" pt="md">
                <RecordForm
                  fields={BROKER_FIELDS}
                  sections={BROKER_DETAIL_SECTIONS}
                  record={record}
                  onSubmit={save}
                  data-testid="broker-detail-form"
                />
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md" data-testid="record-sidebar">
            <BrokerPropertiesRelatedList brokerId={record.id} />
          </Stack>
        </Grid.Col>
      </Grid>
      <RecordModal
        opened={editing}
        onClose={() => setEditing(false)}
        title={`Edit ${record.name}`}
        fields={BROKER_FIELDS}
        sections={BROKER_LAYOUT_SECTIONS}
        record={record}
        onSubmit={save}
        data-testid="broker-edit-form"
      />
    </Stack>
  );
}
