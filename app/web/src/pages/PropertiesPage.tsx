import { Button, Group, Paper, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateProperty } from '@/api/mutations';
import { propertiesQuery } from '@/api/queries';
import type { CreatePropertyDto } from '@/api/types';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { Paginator } from '@/components/Paginator/Paginator';
import { RecordModal } from '@/components/RecordForm/RecordModal';
import { RecordList } from '@/components/RecordList/RecordList';
import {
  PROPERTY_FIELDS,
  PROPERTY_LAYOUT_SECTIONS,
  PROPERTY_OBJECT,
  propertyRoute,
} from '@/pages/properties/propertyLayout';
import { PROPERTY_LIST_VIEW } from '@/pages/properties/propertyListView';

export const LIST_PAGE_SIZE = 25;

/** The New modal uses the page layout minus the read-only System Information section. */
const CREATE_SECTIONS = PROPERTY_LAYOUT_SECTIONS.filter(
  (section) => section.label !== 'System Information',
);

/** `tab:Property__c` -> `listView:Property__c.All` (Name, City, Beds, Price, Status) + the New action. */
export function PropertiesPage() {
  const [pageNumber, setPageNumber] = useState(1);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const properties = useQuery(propertiesQuery({ pageSize: LIST_PAGE_SIZE, pageNumber }));
  const create = useCreateProperty();

  return (
    <>
      <PageHeader
        title={PROPERTY_OBJECT.labelPlural}
        subtitle={`${PROPERTY_LIST_VIEW.label} • ${properties.data?.totalItemCount ?? '…'} items`}
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
        data-testid="properties-list-view"
        data-list-view={PROPERTY_LIST_VIEW.apiName}
      >
        {properties.data && (
          <>
            <RecordList
              fields={PROPERTY_FIELDS}
              columns={PROPERTY_LIST_VIEW.columns}
              records={properties.data.records}
              recordRoute={(property) => propertyRoute(property.id)}
              data-testid="properties-list"
            />
            <Paginator
              pageNumber={pageNumber}
              pageSize={LIST_PAGE_SIZE}
              totalItemCount={properties.data.totalItemCount}
              onPrevious={() => setPageNumber(pageNumber - 1)}
              onNext={() => setPageNumber(pageNumber + 1)}
            />
          </>
        )}
        {properties.isError && (
          <ErrorPanel friendlyMessage="Error retrieving data" errors={properties.error} />
        )}
        {properties.isPending && (
          <Group justify="center" py="xl">
            <Text size="sm" c="dimmed" data-testid="properties-list-loading">
              Loading…
            </Text>
          </Group>
        )}
      </Paper>
      <RecordModal
        opened={creating}
        onClose={() => setCreating(false)}
        title={`New ${PROPERTY_OBJECT.label}`}
        fields={PROPERTY_FIELDS}
        sections={CREATE_SECTIONS}
        onSubmit={async (values) => {
          const created = await create.mutateAsync({
            ...(values as Omit<CreatePropertyDto, 'name' | 'geocode'>),
            name: String(values.name),
            geocode: false,
          });
          navigate(propertyRoute(created.id));
        }}
        data-testid="property-create-form"
      />
    </>
  );
}
