import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authClient as defaultAuthClient } from './auth-client';
import type { AuthUser, AuthClient, SignInInput } from './types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

export function AuthProvider({
  children,
  client = defaultAuthClient,
}: {
  children: ReactNode;
  client?: AuthClient;
}) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .getCurrentUser()
      .then((current) => {
        if (cancelled) return;
        setUser(current);
        setStatus(current ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus('signedOut');
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const signIn = useCallback(
    async (input: SignInInput) => {
      const signedIn = await client.signIn(input);
      setUser(signedIn);
      setStatus('signedIn');
      return signedIn;
    },
    [client],
  );

  const signOut = useCallback(async () => {
    await client.signOut();
    setUser(null);
    setStatus('signedOut');
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, mode: client.mode, signIn, signOut }),
    [status, user, client.mode, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
