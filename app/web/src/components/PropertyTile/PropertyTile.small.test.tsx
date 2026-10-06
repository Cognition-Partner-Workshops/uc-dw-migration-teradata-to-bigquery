import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROPERTY } from '@/test/fixtures/property';
import { renderWithProviders } from '@/test/render';
import { PropertyTile, SMALL_FORM_FACTOR_QUERY } from './PropertyTile';

// Port of lwc/propertyTile/__tests__/propertyTile.small.test.js
// (`@salesforce/client/formFactor` = 'Small' -> the small-form-factor media query matches)
describe('PropertyTile on the Small form factor', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      ...originalMatchMedia(query),
      matches: query === SMALL_FORM_FACTOR_QUERY,
      media: query,
    }));
  });
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('Navigates to property record page on click for Small formFactor', async () => {
    const user = userEvent.setup();
    const onSelected = vi.fn();
    const { router } = renderWithProviders(
      <PropertyTile property={PROPERTY} onSelected={onSelected} />,
    );

    await user.click(screen.getByTestId('property-tile'));

    expect(router.state.location.pathname).toBe(`/properties/${PROPERTY.id}`);
    expect(onSelected).not.toHaveBeenCalled();
  });
});
