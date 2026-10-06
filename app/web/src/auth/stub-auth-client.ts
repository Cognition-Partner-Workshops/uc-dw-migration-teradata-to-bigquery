import { stubGroups } from './groups';
import { AuthError, type AuthClient, type AuthUser, type SignInInput } from './types';

export const STUB_SESSION_KEY = 'dreamhouse.auth.stub';

function toUser(username: string): AuthUser {
  const trimmed = username.trim();
  const local = trimmed.includes('@') ? trimmed.slice(0, trimmed.indexOf('@')) : trimmed;
  return {
    username: trimmed,
    email: trimmed.includes('@') ? trimmed : undefined,
    displayName: local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' '),
    groups: stubGroups(trimmed),
  };
}

/**
 * Local stand-in for Cognito: any non-empty username/password signs in and the session is kept
 * in localStorage so reloads stay signed in. Never used when VITE_AUTH_MODE=cognito.
 * Groups follow the username (`admin*`, `guest*`, see groups.ts) so both roles can be tried.
 */
export function createStubAuthClient(storage: Storage = window.localStorage): AuthClient {
  const read = (): AuthUser | null => {
    const raw = storage.getItem(STUB_SESSION_KEY);
    if (!raw) return null;
    try {
      const user = JSON.parse(raw) as Partial<AuthUser> & Pick<AuthUser, 'username'>;
      return { ...user, groups: user.groups ?? stubGroups(user.username) } as AuthUser;
    } catch {
      storage.removeItem(STUB_SESSION_KEY);
      return null;
    }
  };

  return {
    mode: 'stub',
    async getCurrentUser() {
      return read();
    },
    async getAccessToken() {
      const user = read();
      return user ? `stub-token-for-${user.username}` : null;
    },
    async signIn({ username, password }: SignInInput) {
      if (!username.trim() || !password) {
        throw new AuthError('Enter a username and password.', 'NotAuthorizedException');
      }
      const user = toUser(username);
      storage.setItem(STUB_SESSION_KEY, JSON.stringify(user));
      return user;
    },
    async signOut() {
      storage.removeItem(STUB_SESSION_KEY);
    },
  };
}
