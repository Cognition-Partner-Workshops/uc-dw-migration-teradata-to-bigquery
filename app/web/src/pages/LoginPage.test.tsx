import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STUB_SESSION_KEY } from '@/auth/stub-auth-client';
import { renderApp } from '@/test/render';

describe('LoginPage (stub auth)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects a signed-out visitor to /login and back to the requested page after sign-in', async () => {
    const user = userEvent.setup();
    const { router } = renderApp({ initialPath: '/property-finder' });

    const form = await screen.findByRole('form', { name: 'Sign in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(form).toHaveTextContent(/stub authentication/i);

    await user.type(screen.getByLabelText(/username or email/i), 'agent@dreamhouse.test');
    await user.type(screen.getByLabelText(/^password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('heading', { name: 'Property Finder' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/property-finder');
    expect(JSON.parse(window.localStorage.getItem(STUB_SESSION_KEY) ?? '{}')).toMatchObject({
      username: 'agent@dreamhouse.test',
      displayName: 'Agent',
    });
  });

  it('shows the auth error when the password is empty', async () => {
    const user = userEvent.setup();
    renderApp({ initialPath: '/login' });

    const form = await screen.findByRole('form', { name: 'Sign in' });
    (form as HTMLFormElement).noValidate = true;
    await user.type(screen.getByLabelText(/username or email/i), 'someone');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a username and password.');
  });

  it('shows the API as down when /health fails', async () => {
    const user = userEvent.setup();
    renderApp({ initialPath: '/login' });
    await screen.findByRole('form', { name: 'Sign in' });
    await user.type(screen.getByLabelText(/username or email/i), 'someone');
    await user.type(screen.getByLabelText(/^password/i), 'pw');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByTestId('api-status')).toBeInTheDocument();
    expect(await screen.findByText('API down')).toBeInTheDocument();
  });
});
