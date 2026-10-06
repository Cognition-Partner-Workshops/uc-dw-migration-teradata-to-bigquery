/** `lightning-formatted-number format-style="currency" currency-code="USD"`. */
export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : currencyFormatter.format(value);
}
