import { Button, Center, Grid, Loader, Paper, Stack, Tabs } from '@mantine/core';
import { IconHome } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDeleteProperty, useUpdateProperty } from '@/api/mutations';
import { propertyPicturesQuery, propertyQuery } from '@/api/queries';
import type { UpdatePropertyDto } from '@/api/types';
import { BrokerCard } from '@/components/BrokerCard/BrokerCard';
import { DaysOnMarket } from '@/components/DaysOnMarket/DaysOnMarket';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { FileLink } from '@/components/FileImage/FileImage';
import { PropertyCarousel } from '@/components/PropertyCarousel/PropertyCarousel';
import { PropertyLocation } from '@/components/PropertyLocation/PropertyLocation';
import { PropertyMap } from '@/components/PropertyMap/PropertyMap';
import { DeleteRecordButton } from '@/components/RecordForm/DeleteRecordButton';
import { RecordForm } from '@/components/RecordForm/RecordForm';
import { RecordModal } from '@/components/RecordForm/RecordModal';
import { RecordHighlights } from '@/components/RecordHighlights/RecordHighlights';
import { RelatedList } from '@/components/RelatedList/RelatedList';
import {
  PROPERTY_DATES_SECTIONS,
  PROPERTY_DETAIL_SECTIONS,
  PROPERTY_FIELDS,
  PROPERTY_HIGHLIGHTS,
  PROPERTY_LAYOUT_SECTIONS,
  PROPERTY_OBJECT,
} from '@/pages/properties/propertyLayout';

/** `RelatedFileList` (Files) of the Property page layout: the pictures linked to the record. */
function PropertyFilesRelatedList({ propertyId }: { propertyId: string }) {
  const pictures = useQuery(propertyPicturesQuery(propertyId));
  return (
    <RelatedList
      title="Files"
      count={pictures.data?.length}
      isPending={pictures.isPending}
      error={pictures.error}
      data-testid="property-files"
    >
      {pictures.data && pictures.data.length === 0 ? (
        <Center py="sm" c="dimmed" fz="sm">
          No files to display.
        </Center>
      ) : (
        <Stack gap={4}>
          {pictures.data?.map((file) => (
            <FileLink key={file.id} fileId={file.id} data-testid="property-file">
              {file.title}.{file.fileExtension}
            </FileLink>
          ))}
        </Stack>
      )}
    </RelatedList>
  );
}

/**
 * `flexipages/Property_Record_Page` (`recordHomeTemplateDesktop`): highlights panel on top, the
 * main tabset (Related | Details | Dates | Broker) and the sidebar with brokerCard, daysOnMarket,
 * propertyMap, propertyLocation and propertyCarousel, in that order.
 */
export function PropertyRecordPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const property = useQuery(propertyQuery(id));
  const update = useUpdateProperty(id);
  const remove = useDeleteProperty();
  const [editing, setEditing] = useState(false);

  if (property.isPending) {
    return (
      <Center py="xl" data-testid="property-record-loading">
        <Loader />
      </Center>
    );
  }
  if (property.isError) {
    return (
      <Paper withBorder p="md">
        <ErrorPanel friendlyMessage="Error retrieving data" errors={property.error} />
      </Paper>
    );
  }
  const record = property.data;
  const save = (changes: Record<string, unknown>) =>
    update.mutateAsync({ ...(changes as UpdatePropertyDto), geocode: false });

  return (
    <Stack gap="md" data-testid="property-record-page" data-record-id={record.id}>
      <RecordHighlights
        objectLabel={PROPERTY_OBJECT.label}
        icon={<IconHome size={24} />}
        fields={PROPERTY_FIELDS}
        highlights={PROPERTY_HIGHLIGHTS}
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
              objectLabel={PROPERTY_OBJECT.label}
              recordName={record.name}
              onDelete={() => remove.mutateAsync(record.id)}
              onDeleted={() => navigate(PROPERTY_OBJECT.route)}
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
                <Tabs.Tab value="dates">Dates</Tabs.Tab>
                <Tabs.Tab value="broker">Broker</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="related" pt="md">
                <PropertyFilesRelatedList propertyId={record.id} />
              </Tabs.Panel>
              <Tabs.Panel value="details" pt="md">
                <RecordForm
                  fields={PROPERTY_FIELDS}
                  sections={PROPERTY_DETAIL_SECTIONS}
                  record={record}
                  onSubmit={save}
                  data-testid="property-detail-form"
                />
              </Tabs.Panel>
              <Tabs.Panel value="dates" pt="md">
                <RecordForm
                  fields={PROPERTY_FIELDS}
                  sections={PROPERTY_DATES_SECTIONS}
                  record={record}
                  onSubmit={save}
                  data-testid="property-dates-form"
                />
              </Tabs.Panel>
              <Tabs.Panel value="broker" pt="md">
                <BrokerCard propertyId={record.id} />
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md" data-testid="record-sidebar">
            <BrokerCard propertyId={record.id} />
            <DaysOnMarket recordId={record.id} />
            <PropertyMap recordId={record.id} />
            <PropertyLocation propertyId={record.id} />
            <PropertyCarousel propertyId={record.id} />
          </Stack>
        </Grid.Col>
      </Grid>
      <RecordModal
        opened={editing}
        onClose={() => setEditing(false)}
        title={`Edit ${record.name}`}
        fields={PROPERTY_FIELDS}
        sections={PROPERTY_LAYOUT_SECTIONS}
        record={record}
        onSubmit={save}
        data-testid="property-edit-form"
      />
    </Stack>
  );
}
