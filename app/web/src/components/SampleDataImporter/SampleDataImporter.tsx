import { Button, Card, Group, Modal, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDatabaseImport } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api/client';
import type { ApiErrorDto } from '@/api/types';

export const IMPORT_CONFIRMATION =
  'All existing properties, brokers and contacts will be deleted and replaced with the sample data. Continue?';

function errorMessage(error: ApiErrorDto | undefined, status: number): string {
  return error?.message ?? `Request failed (${status})`;
}

/**
 * Port of `c/sampleDataImporter` (Settings page): `SampleDataController.importSampleData` is
 * `POST /sample-data/import` (dreamhouse-admin only). The deletion is irreversible, so unlike the
 * LWC the button first asks for confirmation; the success / error toasts keep their wording.
 */
export function SampleDataImporter() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const importSampleData = useMutation({
    mutationFn: async () => {
      const { data, error, response } = await api.POST('/sample-data/import');
      if (!response.ok || !data) {
        throw new Error(errorMessage(error as ApiErrorDto | undefined, response.status));
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      notifications.show({
        title: 'Success',
        message: 'Sample data successfully imported',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error while importing data',
        message: error.message,
        color: 'red',
      });
    },
  });

  const handleImportSampleData = () => {
    setConfirmOpen(false);
    importSampleData.mutate();
  };

  return (
    <Card withBorder padding="md" data-testid="sample-data-importer">
      <Group gap="xs" mb="sm">
        <IconDatabaseImport size={18} />
        <Title order={4}>Sample Data Import</Title>
      </Group>
      <Stack gap="sm">
        <Text size="sm">
          Click the button below to initialize the Property and Broker objects with sample data. All
          existing records in these objects will be deleted.
        </Text>
        <Group>
          <Button onClick={() => setConfirmOpen(true)} loading={importSampleData.isPending}>
            Import Data
          </Button>
        </Group>
      </Stack>
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Import sample data?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">{IMPORT_CONFIRMATION}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleImportSampleData} data-testid="confirm-import">
              Delete and import
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
