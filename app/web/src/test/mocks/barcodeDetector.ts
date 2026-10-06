import { vi } from 'vitest';
import type {
  QrCaptureResult,
  QrScanner,
  ScanErrorCode,
} from '@/components/BarcodeScanner/qrScanner';

/** The mobile API's rejection shape (`error.code` / `error.message`); only types are imported so the mock can replace the module. */
function scanFailure(message: string, code: ScanErrorCode) {
  return Object.assign(new Error(message), { code });
}

/**
 * Port of the `lightning/mobileCapabilities` Jest mock (`getBarcodeScanner` and its
 * `setBarcodeScannerAvailable` / `setUserCanceledScan` / `setBarcodeScanError` switches) for the
 * browser `BarcodeDetector` substitute. Tests `vi.mock('./qrScanner', () => import(this))`.
 */
export const SCANNED_PROPERTY_ID = '0031700000pJRRWAA4';

let available = false;
let userCanceled = false;
let scanError = false;

export const endCapture = vi.fn();

export function setBarcodeScannerAvailable() {
  available = true;
}
export function setUserCanceledScan() {
  userCanceled = true;
}
export function setBarcodeScanError() {
  scanError = true;
}
export function resetBarcodeScannerStubs() {
  available = false;
  userCanceled = false;
  scanError = false;
  endCapture.mockClear();
}

export function getBarcodeScanner(): QrScanner | null {
  if (!available) return null;
  return {
    isAvailable: () => true,
    beginCapture: async (): Promise<QrCaptureResult> => {
      if (userCanceled) throw scanFailure('Scanner dismissed', 'userDismissedScanner');
      if (scanError) throw scanFailure('Camera unavailable', 'scanError');
      return { value: SCANNED_PROPERTY_ID };
    },
    endCapture,
  };
}
