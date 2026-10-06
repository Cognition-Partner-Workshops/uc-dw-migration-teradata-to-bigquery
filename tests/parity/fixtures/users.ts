import { createHmac } from 'node:crypto';

/**
 * Apex `System.runAs(user)` → an HTTP request carrying a bearer token for a
 * user in the matching Cognito group (docs/migration/mapping.yaml,
 * conventions.auth). Tokens are HS256-signed with AUTH_TEST_JWT_SECRET so
 * the suites run without a Cognito user pool; the API's guard (plan step
 * s3.4 / UNT3-20) accepts them in NODE_ENV=test instead of the Cognito JWKS.
 */
export interface TestUser {
  username: string;
  email: string;
  groups: string[];
}

export const TEST_JWT_SECRET = process.env.AUTH_TEST_JWT_SECRET ?? 'dreamhouse-characterisation';
export const TEST_ISSUER =
  process.env.AUTH_TEST_ISSUER ?? 'https://cognito-idp.us-east-1.amazonaws.com/dreamhouse-test';

/** TestPropertyController lines 28-53: Standard User + `dreamhouse` permission set. */
export const standardUser: TestUser = {
  username: 'standarduser',
  email: 'standarduser@dreamhouse-testorg.com',
  groups: ['dreamhouse'],
};

/** Admin context the Apex tests run in before runAs (the test-running System Administrator). */
export const adminUser: TestUser = {
  username: 'admin',
  email: 'admin@dreamhouse-testorg.com',
  groups: ['dreamhouse', 'dreamhouse-admin'],
};

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

export function mintAccessToken(
  user: TestUser,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: `test-${user.username}`,
      iss: TEST_ISSUER,
      token_use: 'access',
      username: user.username,
      email: user.email,
      'cognito:groups': user.groups,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signature = createHmac('sha256', TEST_JWT_SECRET).update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${base64url(signature)}`;
}

/** Headers for `runAs(user)`-style requests. */
export function asUser(user: TestUser): Record<string, string> {
  return { authorization: `Bearer ${mintAccessToken(user)}` };
}
