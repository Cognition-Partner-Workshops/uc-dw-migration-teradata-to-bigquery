import { createHmac } from 'node:crypto';

/**
 * Apex `System.runAs(user)` → an HTTP request carrying a bearer token for a user in the
 * matching Cognito group(s). Tokens are HS256-signed with AUTH_TEST_JWT_SECRET so the
 * suites run without a user pool; TokenVerifier accepts them only in AUTH_MODE=test
 * (the NODE_ENV=test default). Shared by the API specs and tests/parity (fixtures/users.ts).
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

/** A signed-in user without the `dreamhouse` permission set: everything Dreamhouse is denied. */
export const guestUser: TestUser = {
  username: 'guest',
  email: 'guest@dreamhouse-testorg.com',
  groups: [],
};

/** A user in some unrelated group only — same as no permission set at all. */
export const otherGroupUser: TestUser = {
  username: 'otherapp',
  email: 'otherapp@dreamhouse-testorg.com',
  groups: ['other-app'],
};

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

export interface MintOptions {
  nowSeconds?: number;
  /** Override the signing secret (to mint a token the API must reject). */
  secret?: string;
  issuer?: string;
  expiresInSeconds?: number;
}

export function mintAccessToken(
  user: TestUser,
  nowOrOptions: number | MintOptions = Math.floor(Date.now() / 1000),
): string {
  const options: MintOptions =
    typeof nowOrOptions === 'number' ? { nowSeconds: nowOrOptions } : nowOrOptions;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: `test-${user.username}`,
      iss: options.issuer ?? TEST_ISSUER,
      token_use: 'access',
      username: user.username,
      email: user.email,
      'cognito:groups': user.groups,
      iat: nowSeconds,
      exp: nowSeconds + (options.expiresInSeconds ?? 3600),
    }),
  );
  const signature = createHmac('sha256', options.secret ?? TEST_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest();
  return `${header}.${payload}.${base64url(signature)}`;
}

/** Headers for `runAs(user)`-style requests. */
export function asUser(user: TestUser): Record<string, string> {
  return { authorization: `Bearer ${mintAccessToken(user)}` };
}
