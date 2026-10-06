import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScanError, getBarcodeScanner, propertyIdFromScan } from './qrScanner';

describe('qrScanner (BarcodeDetector substitute for lightning/mobileCapabilities)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is unavailable where the browser has no BarcodeDetector', () => {
    expect(getBarcodeScanner()).toBeNull();
  });

  it('is available with BarcodeDetector and a camera API, and cancels a pending capture on endCapture', async () => {
    class BarcodeDetector {
      detect = vi.fn(async () => []);
    }
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
    vi.stubGlobal('BarcodeDetector', BarcodeDetector);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const scanner = getBarcodeScanner();
    expect(scanner?.isAvailable()).toBe(true);

    const video = document.createElement('video');
    video.play = vi.fn(async () => undefined);
    const capture = scanner!.beginCapture(video);
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled());
    scanner!.endCapture();

    await expect(capture).rejects.toMatchObject({ code: 'userDismissedScanner' });
    await expect(capture).rejects.toBeInstanceOf(ScanError);
    expect(stop).toHaveBeenCalled();
  });

  it('reads the property id from a bare id or a record URL', () => {
    expect(propertyIdFromScan(' 0031700000pJRRWAA4 ')).toBe('0031700000pJRRWAA4');
    expect(propertyIdFromScan('https://dreamhouse.example/properties/abc-123?x=1')).toBe('abc-123');
    expect(propertyIdFromScan('/properties/abc-123/')).toBe('abc-123');
  });
});
