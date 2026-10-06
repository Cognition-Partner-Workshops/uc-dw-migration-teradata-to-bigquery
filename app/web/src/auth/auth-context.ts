import { createContext } from 'react';
import type { AuthClient, AuthUser, SignInInput } from './types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  mode: AuthClient['mode'];
  signIn: (input: SignInInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
