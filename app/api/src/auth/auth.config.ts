import type { AppConfig } from '../config/config.schema';

export type AuthMode = 'cognito' | 'test' | 'stub';

export interface ResolvedAuthConfig {
  mode: AuthMode;
  cognito?: { issuer: string; jwksUrl: string; clientId: string };
  test?: { secret: string; issuer: string };
}

/**
 * `AUTH_MODE` defaults per NODE_ENV — production verifies Cognito access tokens against the
 * user pool's JWKS; test accepts the HS256 tokens tests/parity/fixtures/users.ts mints
 * (`System.runAs`); development accepts the web stub client's `stub-token-for-<user>`.
 * Production refuses anything but cognito so a misconfigured task can never run open.
 */
export function resolveAuthConfig(config: AppConfig): ResolvedAuthConfig {
  const mode: AuthMode =
    config.AUTH_MODE ??
    (config.NODE_ENV === 'production' ? 'cognito' : config.NODE_ENV === 'test' ? 'test' : 'stub');
  if (config.NODE_ENV === 'production' && mode !== 'cognito') {
    throw new Error(`Invalid configuration: AUTH_MODE=${mode} is not allowed in production`);
  }
  switch (mode) {
    case 'cognito': {
      const userPoolId = config.COGNITO_USER_POOL_ID;
      const clientId = config.COGNITO_CLIENT_ID;
      if (!userPoolId || !clientId) {
        throw new Error(
          'Invalid configuration: AUTH_MODE=cognito requires COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID',
        );
      }
      const region = config.COGNITO_REGION ?? userPoolId.split('_')[0] ?? config.AWS_REGION;
      const issuer =
        config.COGNITO_ISSUER ?? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
      return {
        mode,
        cognito: { issuer, jwksUrl: `${issuer}/.well-known/jwks.json`, clientId },
      };
    }
    case 'test':
      return {
        mode,
        test: { secret: config.AUTH_TEST_JWT_SECRET, issuer: config.AUTH_TEST_ISSUER },
      };
    case 'stub':
      return { mode };
  }
}

/**
 * Groups of a stub (local development) user, derived from the username so the two roles can
 * be tried without a user pool: `admin*` → dreamhouse + dreamhouse-admin, `guest*` → none
 * (what a user without the permission set sees), anything else → dreamhouse. The web stub
 * client (app/web/src/auth/stub-auth-client.ts) applies the same rule.
 */
export function stubGroups(username: string): string[] {
  const local = username.toLowerCase().split('@')[0];
  if (local.startsWith('admin')) return ['dreamhouse', 'dreamhouse-admin'];
  if (local.startsWith('guest')) return [];
  return ['dreamhouse'];
}
