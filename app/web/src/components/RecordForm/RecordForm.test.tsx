import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/api/errors';
import { BROKER_DETAIL_SECTIONS, BROKER_FIELDS } from '@/pages/brokers/brokerLayout';
import { BROKER } from '@/test/fixtures/property';
import { renderWithProviders } from '@/test/render';
import { RecordForm } from './RecordForm';

const fieldError = (field: string, message: string) =>
  new ApiRequestError(
    400,
    {
      message: 'Validation failed',
      output: { errors: [], fieldErrors: { [field]: [{ field, errorCode: 'INVALID', message }] } },
    },
    'Saving failed',
  );

describe('RecordForm (lightning-record-form)', () => {
  it('renders the layout sections and fields in order, read-only, with inline edit pencils', () => {
    renderWithProviders(
      <RecordForm
        fields={BROKER_FIELDS}
        sections={BROKER_DETAIL_SECTIONS}
        record={BROKER}
        onSubmit={vi.fn()}
      />,
    );
    const sections = screen.getAllByTestId('record-form-section');
    expect(sections.map((section) => within(section).getByRole('heading').textContent)).toEqual([
      'Picture',
      'Information',
      'System Information',
    ]);
    const information = sections[1];
    expect(
      within(information)
        .getAllByTestId(/^field-/)
        .map((field) => field.getAttribute('data-field')),
    ).toEqual(['Name', 'Title__c', 'Email__c', 'Phone__c', 'Mobile_Phone__c']);
    expect(screen.getByTestId('field-name')).toHaveTextContent(BROKER.name);
    expect(screen.getByTestId('record-form')).toHaveAttribute('data-mode', 'view');
    expect(screen.getByTestId('edit-name')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-createdAt')).not.toBeInTheDocument();
  });

  it('inline edits: the pencil opens the inputs and Save sends only the changed fields', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <RecordForm
        fields={BROKER_FIELDS}
        sections={BROKER_DETAIL_SECTIONS}
        record={BROKER}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByTestId('edit-title'));
    expect(screen.getByTestId('record-form')).toHaveAttribute('data-mode', 'edit');
    const title = screen.getByTestId('input-title');
    expect(title).toHaveFocus();
    await user.clear(title);
    await user.type(title, 'Principal Broker');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({ title: 'Principal Broker' });
    expect(await screen.findByTestId('record-form')).toHaveAttribute('data-mode', 'view');
  });

  it('shows a server field error under the matching input and stays in edit mode', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(fieldError('email', 'email must be an email'));
    renderWithProviders(
      <RecordForm
        fields={BROKER_FIELDS}
        sections={BROKER_DETAIL_SECTIONS}
        record={BROKER}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByTestId('edit-email'));
    await user.clear(screen.getByTestId('input-email'));
    await user.type(screen.getByTestId('input-email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('email must be an email')).toBeInTheDocument();
    expect(screen.getByTestId('input-email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('record-form')).toHaveAttribute('data-mode', 'edit');
    expect(screen.getByTestId('record-form-error')).toHaveTextContent(
      'Review the errors on this page.',
    );
  });

  it('shows record-level errors at the top of the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiRequestError(
        409,
        {
          message: 'Conflict',
          output: { errors: [{ message: 'Record was modified' }], fieldErrors: {} },
        },
        'Saving failed',
      ),
    );
    renderWithProviders(
      <RecordForm
        fields={BROKER_FIELDS}
        sections={BROKER_DETAIL_SECTIONS}
        record={BROKER}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByTestId('edit-title'));
    await user.type(screen.getByTestId('input-title'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByTestId('record-form-error')).toHaveTextContent('Record was modified');
  });

  it('requires the required fields before submitting a new record and cancels back', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <RecordForm
        fields={BROKER_FIELDS}
        sections={BROKER_DETAIL_SECTIONS}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId('record-form')).toHaveAttribute('data-mode', 'edit');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Complete this field.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByTestId('input-name'), 'New Broker');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'New Broker' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
