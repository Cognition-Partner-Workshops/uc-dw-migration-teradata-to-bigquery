/** `MAX_DAYS_CHART = 90`. */
export const MAX_DAYS_CHART = 90;

export type DaysOnMarketStatus = 'normal' | 'warning' | 'alert';

/** `< 30` normal, `< 60` warning, otherwise alert. */
export function daysOnMarketStatus(days: number): DaysOnMarketStatus {
  if (days < 30) return 'normal';
  if (days < 60) return 'warning';
  return 'alert';
}
