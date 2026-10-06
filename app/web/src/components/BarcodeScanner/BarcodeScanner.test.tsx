import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCANNED_PROPERTY_ID,
  endCapture,
  resetBarcodeScannerStubs,
  setBarcodeScanError,
  setBarcodeScannerAvailable,
  setUserCanceledScan,
} from '@/test/mocks/barcodeDetector';
import { mockNotifications } from '@/test/mocks/notifications';
import { renderWithProviders } from '@/test/render';
import { BarcodeScanner } from './BarcodeScanner';

vi.mock('./qrScanner', async () => {
  const actual = await vi.importActual<typeof import('./qrScanner')>('./qrScanner');
  const stubs = await import('@/test/mocks/barcodeDetector');
  return { ...actual, getBarcodeScanner: stubs.getBarcodeScanner };
});

// Port of lwc/barcodeScanner/__tests__/barcodeScanner.test.js: lightning/mobileCapabilities ->
// the BarcodeDetector substitute (qrScanner.ts), NavigationMixin -> the router location.
describe('BarcodeScanner (c-barcode-scanner)', () => {
  let toasts: ReturnType<typeof mockNotifications>;
  beforeEach(() => {
    toasts = mockNotifications();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    resetBarcodeScannerStubs();
  });

  it('directs the user to a capable browser / manual entry when the scanner is unavailable', () => {
    renderWithProviders(<BarcodeScanner />);

    expect(screen.getByTestId('scanner-directions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scan QR Code' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Property Id')).toBeInTheDocument();
  });

  it('shows the `Scan QR Code` button when the scanner is available', () => {
    setBarcodeScannerAvailable();
    renderWithProviders(<BarcodeScanner />);

    expect(screen.getByRole('button', { name: 'Scan QR Code' })).toBeInTheDocument();
    expect(screen.queryByTestId('scanner-directions')).not.toBeInTheDocument();
  });

  it('navigates to the expected record view when a QR code is correctly scanned', async () => {
    setBarcodeScannerAvailable();
    const { router } = renderWithProviders(<BarcodeScanner />, { initialPath: '/property-finder' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Scan QR Code' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/properties/${SCANNED_PROPERTY_ID}`),
    );
    expect(endCapture).toHaveBeenCalledTimes(1);
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('triggers a toast notification when the user cancels the scan', async () => {
    setBarcodeScannerAvailable();
    setUserCanceledScan();
    const { router } = renderWithProviders(<BarcodeScanner />, { initialPath: '/property-finder' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Scan QR Code' }));

    await waitFor(() => expect(toasts.show).toHaveBeenCalledTimes(1));
    expect(toasts.toast()).toMatchObject({ title: 'Scanning Canceled' });
    expect(router.state.location.pathname).toBe('/property-finder');
    expect(endCapture).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when there was a problem with the scan', async () => {
    setBarcodeScannerAvailable();
    setBarcodeScanError();
    renderWithProviders(<BarcodeScanner />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Scan QR Code' }));

    await waitFor(() => expect(toasts.show).toHaveBeenCalledTimes(1));
    expect(toasts.toast()).toMatchObject({
      title: 'Barcode Scanner Error',
      message: 'There was a problem scanning the QR code: Camera unavailable',
      color: 'red',
    });
  });

  it('manual entry (the fallback) navigates to the record view too, accepting a record URL', async () => {
    const { router } = renderWithProviders(<BarcodeScanner />, { initialPath: '/property-finder' });
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText('Property Id'),
      `https://app.example/properties/${SCANNED_PROPERTY_ID}`,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(router.state.location.pathname).toBe(`/properties/${SCANNED_PROPERTY_ID}`);
  });
});
