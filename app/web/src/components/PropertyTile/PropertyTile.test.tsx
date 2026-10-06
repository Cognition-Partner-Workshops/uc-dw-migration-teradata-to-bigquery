import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PROPERTY } from '@/test/fixtures/property';
import { renderWithProviders } from '@/test/render';
import { PropertyTile } from './PropertyTile';

// Port of lwc/propertyTile/__tests__/propertyTile.test.js
describe('PropertyTile (c-property-tile)', () => {
  it('displays a property in the tile', () => {
    renderWithProviders(<PropertyTile property={PROPERTY} />);

    expect(screen.getByTestId('property-tile')).toHaveAttribute('title', PROPERTY.name);
    expect(screen.getByTestId('property-tile-title')).toHaveTextContent(
      `${PROPERTY.city} • ${PROPERTY.name}`,
    );
    expect(screen.getByTestId('property-tile-beds-baths')).toHaveTextContent(
      `Beds: ${PROPERTY.beds} - Baths: ${PROPERTY.baths}`,
    );
    const price = screen.getByTestId('property-tile-price');
    expect(price).toHaveAttribute('data-value', String(PROPERTY.price));
    expect(price).toHaveTextContent('$450,000.00');
  });

  it('displays the correct background image in the tile', () => {
    renderWithProviders(<PropertyTile property={PROPERTY} />);
    expect(screen.getByTestId('property-tile-picture')).toHaveStyle({
      backgroundImage: `url(${PROPERTY.thumbnail})`,
    });
  });

  it('Fires the property selected event on click for non Small formFactors', async () => {
    const user = userEvent.setup();
    const onSelected = vi.fn();
    const { router } = renderWithProviders(
      <PropertyTile property={PROPERTY} onSelected={onSelected} />,
    );

    await user.click(screen.getByTestId('property-tile'));

    expect(onSelected).toHaveBeenCalledWith(PROPERTY.id);
    expect(router.state.location.pathname).toBe('/');
  });
});
