/** `lightning-formatted-number format-style="currency" currency-code="USD"`. */
export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : currencyFormatter.format(value);
}

/** `lightning-formatted-date-time` on a Date field (YYYY-MM-DD, no time zone shift). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
    new Date(year, month - 1, day),
  );
}

/** `lightning-formatted-date-time` on a DateTime field (CreatedDate / LastModifiedDate). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** `lightning-formatted-number` (decimal). */
export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  return value === null || value === undefined
    ? ''
    : new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}
