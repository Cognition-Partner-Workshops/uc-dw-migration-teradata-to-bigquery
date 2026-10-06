import { describe, expect, it } from 'vitest';
import { createAuthClient } from './auth-client';
import { createStubAuthClient } from './stub-auth-client';

describe('createAuthClient', () => {
  it('defaults to the stub client', () => {
    expect(createAuthClient({} as ImportMetaEnv).mode).toBe('stub');
  });

  it('builds a Cognito client when configured', () => {
    const client = createAuthClient({
      VITE_AUTH_MODE: 'cognito',
      VITE_COGNITO_USER_POOL_ID: 'us-east-1_example',
      VITE_COGNITO_CLIENT_ID: 'client123',
    } as ImportMetaEnv);
    expect(client.mode).toBe('cognito');
  });

  it('refuses cognito mode without a user pool', () => {
    expect(() => createAuthClient({ VITE_AUTH_MODE: 'cognito' } as ImportMetaEnv)).toThrow(
      /VITE_COGNITO_USER_POOL_ID/,
    );
  });
});

describe('stub auth client', () => {
  it('round-trips a session through storage and produces a bearer token', async () => {
    const client = createStubAuthClient();
    expect(await client.getCurrentUser()).toBeNull();
    expect(await client.getAccessToken()).toBeNull();

    const user = await client.signIn({ username: 'mary.lou-smith@example.com', password: 'x' });
    expect(user).toEqual({
      username: 'mary.lou-smith@example.com',
      email: 'mary.lou-smith@example.com',
      displayName: 'Mary Lou Smith',
    });
    expect(await createStubAuthClient().getCurrentUser()).toEqual(user);
    expect(await client.getAccessToken()).toMatch(/^stub-token-for-/);

    await client.signOut();
    expect(await client.getCurrentUser()).toBeNull();
  });
});
