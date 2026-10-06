import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { reduceErrors } from '@/lib/errors';

/** The standard Delete record action: confirm, `deleteRecord`, then the caller navigates away. */
export function DeleteRecordButton({
  objectLabel,
  recordName,
  onDelete,
  onDeleted,
}: {
  objectLabel: string;
  recordName: string;
  onDelete: () => Promise<unknown>;
  onDeleted: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      setOpened(false);
      onDeleted();
    } catch (deleteError) {
      setError(deleteError);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button variant="default" onClick={() => setOpened(true)} data-testid="record-action-delete">
        Delete
      </Button>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={`Delete ${objectLabel}`}
        data-testid="delete-record-modal"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete this {objectLabel.toLowerCase()}
            {recordName ? ` "${recordName}"` : ''}?
          </Text>
          {error ? (
            <Alert color="red" data-testid="delete-record-error">
              {reduceErrors(error).join(', ')}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => void confirm()}
              loading={deleting}
              data-testid="delete-record-confirm"
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
