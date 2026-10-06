import { notifications } from '@mantine/notifications';
import { vi } from 'vitest';

/**
 * Port of the `lightning/platformShowToastEvent` Jest mock: `ShowToastEvent` became
 * `notifications.show`, so tests spy on it and read the toast payloads back.
 */
export function mockNotifications() {
  const show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
  return {
    show,
    /** `event.detail` of the n-th toast (title / message / color). */
    toast: (index = 0) => show.mock.calls[index]?.[0],
  };
}
