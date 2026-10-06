import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Paginator } from './Paginator';

// Port of lwc/paginator/__tests__/paginator.test.js
describe('Paginator (c-paginator)', () => {
  it('sends "next" event on button click', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    renderWithProviders(
      <Paginator pageNumber={1} pageSize={9} totalItemCount={12} onNext={onNext} />,
    );

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('sends "previous" event on button click', async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    renderWithProviders(
      <Paginator pageNumber={2} pageSize={9} totalItemCount={12} onPrevious={onPrevious} />,
    );

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('displays total item count, page number, and number of pages with zero items', () => {
    renderWithProviders(<Paginator pageNumber={1} pageSize={9} totalItemCount={0} />);
    expect(screen.getByTestId('paginator-info')).toHaveTextContent('0 items • page 0 of 0');
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('displays total item count, page number, and number of pages with some items', () => {
    renderWithProviders(<Paginator pageNumber={2} pageSize={9} totalItemCount={20} />);
    expect(screen.getByTestId('paginator-info')).toHaveTextContent('20 items • page 2 of 3');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('does not display next page button when reaching max page offset', () => {
    renderWithProviders(<Paginator pageNumber={200} pageSize={10} totalItemCount={5000} />);
    expect(screen.getByTestId('paginator-info')).toHaveTextContent('5000 items • page 200 of 500');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});
