import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ErrorPanel } from './ErrorPanel';

// Port of lwc/errorPanel/__tests__/errorPanel.test.js
describe('ErrorPanel (c-error-panel)', () => {
  it('displays a default friendly message', () => {
    renderWithProviders(<ErrorPanel />);
    expect(screen.getByTestId('error-panel-message')).toHaveTextContent('Error retrieving data');
  });

  it('displays a custom friendly message', () => {
    renderWithProviders(<ErrorPanel friendlyMessage="Errors are bad." />);
    expect(screen.getByTestId('error-panel-message')).toHaveTextContent('Errors are bad.');
  });

  it('displays no error details when no errors are passed as parameters', () => {
    renderWithProviders(<ErrorPanel />);
    expect(screen.queryByRole('button', { name: /show details/i })).toBeNull();
    expect(screen.queryByTestId('error-panel-details')).toBeNull();
  });

  it('displays error details when errors are passed as parameters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorPanel errors={{ body: { message: 'Mock error message' } }} />);

    expect(screen.queryByTestId('error-panel-details')).toBeNull();
    await user.click(screen.getByRole('button', { name: /show details/i }));
    expect(screen.getByTestId('error-panel-details')).toHaveTextContent('Mock error message');
  });

  it('renders the inline message variant', () => {
    renderWithProviders(<ErrorPanel type="inlineMessage" errors={{ message: 'boom' }} />);
    const panel = screen.getByTestId('error-panel');
    expect(panel).toHaveAttribute('data-type', 'inlineMessage');
    expect(panel).toHaveTextContent('Error retrieving data.');
    expect(screen.getByRole('button', { name: /show details/i })).toBeInTheDocument();
  });

  it('renders the no data illustration by default', () => {
    renderWithProviders(<ErrorPanel />);
    expect(screen.getByTestId('error-panel')).toHaveAttribute('data-type', 'noDataIllustration');
  });
});
