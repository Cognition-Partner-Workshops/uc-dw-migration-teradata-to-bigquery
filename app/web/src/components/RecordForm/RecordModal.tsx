import { Modal } from '@mantine/core';
import { RecordForm, type RecordFormProps } from './RecordForm';

/**
 * The standard New / Edit record actions: the page layout in a modal (`force:recordEdit`),
 * closed by Cancel or a successful save.
 */
export function RecordModal({
  opened,
  onClose,
  title,
  ...form
}: Omit<RecordFormProps, 'mode' | 'onCancel' | 'onSubmitted'> & {
  opened: boolean;
  onClose: () => void;
  title: string;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl" data-testid="record-modal">
      {opened && (
        <RecordForm
          {...form}
          mode="edit"
          onCancel={onClose}
          onSubmitted={onClose}
          data-testid={form['data-testid'] ?? 'record-modal-form'}
        />
      )}
    </Modal>
  );
}
