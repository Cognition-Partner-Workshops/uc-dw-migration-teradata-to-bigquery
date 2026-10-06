/**
 * Browser substitute for `lightning/mobileCapabilities` `getBarcodeScanner()`: the Shape
 * Detection API's `BarcodeDetector` reading QR codes off a camera stream. The surface mirrors the
 * mobile API (`isAvailable` / `beginCapture` / `endCapture`, `userDismissedScanner` on cancel)
 * so `BarcodeScanner` keeps the LWC's control flow.
 */
export interface QrCaptureResult {
  value: string;
}

export interface QrScanner {
  isAvailable(): boolean;
  /** Streams the camera into `video` and resolves with the first QR code seen. */
  beginCapture(video: HTMLVideoElement): Promise<QrCaptureResult>;
  /** Stops the camera; a pending capture rejects with `userDismissedScanner`. */
  endCapture(): void;
}

export type ScanErrorCode = 'userDismissedScanner' | 'scanError';

export class ScanError extends Error {
  constructor(
    message: string,
    readonly code: ScanErrorCode,
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

const SCAN_INTERVAL_MS = 250;

function barcodeDetectorConstructor(): BarcodeDetectorConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

/** `getBarcodeScanner()`: null where the browser has neither `BarcodeDetector` nor a camera API. */
export function getBarcodeScanner(): QrScanner | null {
  const Detector = barcodeDetectorConstructor();
  if (!Detector || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let dismiss: (() => void) | null = null;
  let dismissed = false;
  const dismissedError = () => new ScanError('Scanning session canceled.', 'userDismissedScanner');

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };

  return {
    isAvailable: () => true,
    async beginCapture(video) {
      dismissed = false;
      const detector = new Detector({ formats: ['qr_code'] });
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch (error) {
        throw new ScanError(
          error instanceof Error ? error.message : 'Camera unavailable',
          'scanError',
        );
      }
      if (dismissed) {
        stop();
        throw dismissedError();
      }
      video.srcObject = stream;
      await video.play();
      if (dismissed) {
        stop();
        throw dismissedError();
      }

      return new Promise<QrCaptureResult>((resolve, reject) => {
        dismiss = () => reject(dismissedError());
        timer = setInterval(async () => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          try {
            const codes = await detector.detect(video);
            const code = codes.find((c) => c.rawValue);
            if (code) {
              stop();
              dismiss = null;
              resolve({ value: code.rawValue });
            }
          } catch (error) {
            stop();
            dismiss = null;
            reject(
              new ScanError(
                error instanceof Error ? error.message : 'Detection failed',
                'scanError',
              ),
            );
          }
        }, SCAN_INTERVAL_MS);
      });
    },
    endCapture() {
      dismissed = true;
      stop();
      dismiss?.();
      dismiss = null;
    },
  };
}

/** `error.code` of a capture failure, as the LWC read it off the mobile API's error. */
export function scanErrorCode(error: unknown): ScanErrorCode | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (code === 'userDismissedScanner' || code === 'scanError') return code;
  }
  return undefined;
}

/** QR codes carry the Property__c Id in the org; here they may also carry the record URL. */
export function propertyIdFromScan(value: string): string {
  const match = value.trim().match(/\/properties\/([^/?#]+)/);
  return (match ? match[1] : value.trim()).replace(/\/+$/, '');
}
