import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearRememberedProperties, rememberProperties } from '@/state/selectedProperty';
import { PROPERTY } from '@/test/fixtures/property';
import { renderWithProviders } from '@/test/render';
import { PropertySummary } from './PropertySummary';

// Port of lwc/propertySummary/__tests__/propertySummary.test.js
describe('PropertySummary (c-property-summary)', () => {
  beforeEach(() => {
    clearRememberedProperties();
  });

  it('renders an error panel when no property is selected', () => {
    renderWithProviders(<PropertySummary />);
    expect(screen.getByTestId('error-panel')).toHaveTextContent('Select a property to see details');
  });

  it('renders an error panel when the record cannot be resolved', () => {
    renderWithProviders(<PropertySummary />, { initialPath: '/?selected=unknown-id' });
    expect(screen.getByTestId('error-panel')).toHaveTextContent('Error retrieving data');
  });

  it('renders the record form when a property is selected', () => {
    rememberProperties([PROPERTY]);
    renderWithProviders(<PropertySummary />, { initialPath: `/?selected=${PROPERTY.id}` });

    expect(screen.getByTestId('property-summary-name')).toHaveTextContent(PROPERTY.name);
    expect(screen.getByAltText('Property picture')).toHaveAttribute('src', PROPERTY.thumbnail);
    const form = screen.getByTestId('property-summary-form');
    expect(form).toHaveTextContent('Beds');
    expect(form).toHaveTextContent('Baths');
    expect(form).toHaveTextContent('Price');
    expect(form).toHaveTextContent('Broker');
    expect(screen.getByTestId('property-summary-beds')).toHaveTextContent('3');
    expect(screen.getByTestId('property-summary-baths')).toHaveTextContent('1');
    expect(screen.getByTestId('property-summary-price')).toHaveTextContent('$450,000.00');
    expect(screen.queryByTestId('error-panel')).toBeNull();
  });

  it('navigates to the record page from the Navigate to Record action', async () => {
    const user = userEvent.setup();
    rememberProperties([PROPERTY]);
    const { router } = renderWithProviders(<PropertySummary />, {
      initialPath: `/?selected=${PROPERTY.id}`,
    });

    await user.click(screen.getByRole('button', { name: 'Navigate to Record' }));
    expect(router.state.location.pathname).toBe(`/properties/${PROPERTY.id}`);
  });
});
