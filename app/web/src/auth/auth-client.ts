import { createCognitoAuthClient } from './cognito-auth-client';
import { createStubAuthClient } from './stub-auth-client';
import type { AuthClient } from './types';

export function createAuthClient(env: ImportMetaEnv = import.meta.env): AuthClient {
  if (env.VITE_AUTH_MODE === 'cognito') {
    const userPoolId = env.VITE_COGNITO_USER_POOL_ID;
    const clientId = env.VITE_COGNITO_CLIENT_ID;
    if (!userPoolId || !clientId) {
      throw new Error(
        'VITE_AUTH_MODE=cognito requires VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID',
      );
    }
    return createCognitoAuthClient({ userPoolId, clientId });
  }
  return createStubAuthClient();
}

export const authClient: AuthClient = createAuthClient();
