import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { AuthError, type AuthClient, type AuthUser, type SignInInput } from './types';

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
}

function getSession(user: CognitoUser): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      resolve(err || !session?.isValid() ? null : session);
    });
  });
}

function toUser(session: CognitoUserSession, fallbackUsername: string): AuthUser {
  const payload = session.getIdToken().payload as Record<string, unknown>;
  const str = (key: string) =>
    typeof payload[key] === 'string' ? (payload[key] as string) : undefined;
  const username = str('cognito:username') ?? fallbackUsername;
  const email = str('email');
  const rawGroups = payload['cognito:groups'];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.filter((g): g is string => typeof g === 'string')
    : [];
  return { username, email, displayName: str('name') ?? email ?? username, groups };
}

/** Amazon Cognito user pool client (USER_SRP_AUTH via amazon-cognito-identity-js). */
export function createCognitoAuthClient(config: CognitoConfig): AuthClient {
  const pool = new CognitoUserPool({ UserPoolId: config.userPoolId, ClientId: config.clientId });

  const currentSession = async () => {
    const user = pool.getCurrentUser();
    if (!user) return null;
    const session = await getSession(user);
    return session ? { user, session } : null;
  };

  return {
    mode: 'cognito',
    async getCurrentUser() {
      const current = await currentSession();
      return current ? toUser(current.session, current.user.getUsername()) : null;
    },
    async getAccessToken() {
      const current = await currentSession();
      return current ? current.session.getAccessToken().getJwtToken() : null;
    },
    signIn({ username, password }: SignInInput) {
      const user = new CognitoUser({ Username: username, Pool: pool });
      return new Promise<AuthUser>((resolve, reject) => {
        user.authenticateUser(
          new AuthenticationDetails({ Username: username, Password: password }),
          {
            onSuccess: (session) => resolve(toUser(session, username)),
            onFailure: (err: Error & { code?: string }) =>
              reject(new AuthError(err.message, err.code ?? err.name)),
            newPasswordRequired: () =>
              reject(
                new AuthError(
                  'A new password is required; complete the first sign-in in the Cognito hosted UI.',
                  'NewPasswordRequired',
                ),
              ),
          },
        );
      });
    },
    async signOut() {
      pool.getCurrentUser()?.signOut();
    },
  };
}
