import { Button, Card, Group, Modal, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconScan } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBarcodeScanner, propertyIdFromScan, scanErrorCode, type QrScanner } from './qrScanner';

export const SCANNER_DIRECTIONS =
  'To use the QR Code Scanner, open Dreamhouse in a browser with camera access that supports the BarcodeDetector API (Chrome or Edge), or enter the property Id below.';

/**
 * Port of `c/barcodeScanner` (Property Finder, left column). `lightning/mobileCapabilities` is
 * Salesforce-mobile only, so the substitute is the browser `BarcodeDetector` over the camera
 * (`qrScanner.ts`) with a manual entry fallback; a scanned value navigates to the record page and
 * cancel / failure surface as (sticky) toasts like the mobile experience.
 */
export function BarcodeScanner() {
  const navigate = useNavigate();
  const scannerRef = useRef<QrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanButtonEnabled, setScanButtonEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualId, setManualId] = useState('');

  useEffect(() => {
    scannerRef.current = getBarcodeScanner();
    setScanButtonEnabled(scannerRef.current?.isAvailable() ?? false);
  }, []);

  const openProperty = (value: string) => {
    const propertyId = propertyIdFromScan(value);
    if (propertyId) navigate(`/properties/${propertyId}`);
  };

  const handleBeginScanClick = async () => {
    const scanner = scannerRef.current;
    if (!scanner?.isAvailable()) return;
    setScanning(true);
    try {
      const video = videoRef.current ?? document.createElement('video');
      const captureResult = await scanner.beginCapture(video);
      openProperty(captureResult.value);
    } catch (error) {
      if (scanErrorCode(error) === 'userDismissedScanner') {
        notifications.show({
          title: 'Scanning Canceled',
          message: 'Scanning session canceled.',
          autoClose: false,
        });
      } else {
        notifications.show({
          title: 'Barcode Scanner Error',
          message: `There was a problem scanning the QR code: ${error instanceof Error ? error.message : String(error)}`,
          color: 'red',
          autoClose: false,
        });
      }
    } finally {
      scanner.endCapture();
      setScanning(false);
    }
  };

  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    openProperty(manualId);
  };

  return (
    <Card withBorder padding="md" data-testid="barcode-scanner">
      <Group gap="xs" mb="sm">
        <IconScan size={18} />
        <Title order={4}>Property QR Code Scanner</Title>
      </Group>
      <Stack gap="sm">
        {scanButtonEnabled ? (
          <>
            <Text size="sm" c="dimmed" ta="center">
              Click <strong>Scan QR Code</strong> to open a QR Code scanner camera view. Position a
              QR Code in the scanner view to scan it.
            </Text>
            <Group justify="center">
              <Button
                leftSection={<IconScan size={16} />}
                title="Open a camera view and look for a barcode to scan"
                onClick={handleBeginScanClick}
                loading={scanning}
              >
                Scan QR Code
              </Button>
            </Group>
          </>
        ) : (
          <Text size="sm" c="dimmed" ta="center" data-testid="scanner-directions">
            {SCANNER_DIRECTIONS}
          </Text>
        )}
        <form onSubmit={handleManualSubmit} data-testid="scanner-manual-entry">
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <TextInput
              label="Property Id"
              placeholder="Property Id or record URL"
              value={manualId}
              onChange={(event) => setManualId(event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button type="submit" variant="default" disabled={!manualId.trim()}>
              Open
            </Button>
          </Group>
        </form>
      </Stack>
      <Modal
        opened={scanning}
        onClose={() => scannerRef.current?.endCapture()}
        title="Scan a QR Code"
        centered
      >
        <Stack gap="sm">
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', borderRadius: 4, background: '#000' }}
            data-testid="scanner-video"
          />
          <Text size="sm" c="dimmed" ta="center">
            Position a QR Code in the camera view.
          </Text>
          <Button variant="default" onClick={() => scannerRef.current?.endCapture()}>
            Cancel
          </Button>
        </Stack>
      </Modal>
    </Card>
  );
}
