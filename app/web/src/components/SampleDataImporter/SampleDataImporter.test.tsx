import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { mockNotifications } from '@/test/mocks/notifications';
import { renderApp, renderWithProviders, signedInStubClient } from '@/test/render';
import { IMPORT_CONFIRMATION, SampleDataImporter } from './SampleDataImporter';

const importResult = {
  deleted: { brokers: 8, properties: 12, contacts: 5 },
  inserted: { brokers: 8, properties: 12, contacts: 5 },
};

/** `importSampleData.mockRejectedValue({ message })` as the API answers it. */
const importError = {
  statusCode: 500,
  error: 'Internal Server Error',
  message: 'An internal server error has occurred',
  output: { errors: [], fieldErrors: {} },
};

// Port of lwc/sampleDataImporter/__tests__/sampleDataImporter.test.js; `importSampleData` is
// POST /sample-data/import and ShowToastEvent is `notifications.show`.
describe('SampleDataImporter (c-sample-data-importer)', () => {
  let toasts: ReturnType<typeof mockNotifications>;
  beforeEach(() => {
    toasts = mockNotifications();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function clickImportAndConfirm() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Import Data' }));
    expect(await screen.findByText(IMPORT_CONFIRMATION)).toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-import'));
    return user;
  }

  it('fires success event when importSampleData runs successfully', async () => {
    const { requests } = mockApi((url, request) =>
      url.pathname.endsWith('/sample-data/import') && request.method === 'POST'
        ? jsonResponse(importResult)
        : jsonResponse({ statusCode: 404 }, 404),
    );
    renderWithProviders(<SampleDataImporter />);

    await clickImportAndConfirm();

    await waitFor(() => expect(toasts.show).toHaveBeenCalledTimes(1));
    expect(toasts.toast()).toMatchObject({
      title: 'Success',
      message: 'Sample data successfully imported',
      color: 'green',
    });
    expect(requests().map((u) => u.pathname)).toEqual(['/api/sample-data/import']);
  });

  it('fires error event when importSampleData runs with error', async () => {
    mockApi(() => jsonResponse(importError, 500));
    renderWithProviders(<SampleDataImporter />);

    await clickImportAndConfirm();

    await waitFor(() => expect(toasts.show).toHaveBeenCalledTimes(1));
    expect(toasts.toast()).toMatchObject({
      title: 'Error while importing data',
      message: importError.message,
      color: 'red',
    });
  });

  it('does not call the API when the confirmation is cancelled', async () => {
    const { spy } = mockApi(() => jsonResponse(importResult));
    renderWithProviders(<SampleDataImporter />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Import Data' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(spy).not.toHaveBeenCalled();
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('is on the Settings page for dreamhouse-admin and unreachable for the dreamhouse group', async () => {
    mockApi(() => jsonResponse({ status: 'ok' }));
    const admin = renderApp({
      initialPath: '/settings',
      authClient: await signedInStubClient('admin@example.com'),
    });
    expect(await screen.findByTestId('sample-data-importer')).toBeInTheDocument();
    admin.unmount();

    renderApp({
      initialPath: '/settings',
      authClient: await signedInStubClient('jane@example.com'),
    });
    expect(await screen.findByTestId('access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('sample-data-importer')).not.toBeInTheDocument();
  });
});
