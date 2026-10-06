import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

/** Cognito group the `dreamhouse_admin` permission set maps to (docs/migration/mapping.yaml, target.auth). */
export const ADMIN_GROUP = 'dreamhouse-admin';

export interface BearerClaims {
  sub?: string;
  username?: string;
  email?: string;
  /** `cognito:groups` */
  groups: string[];
}

/** Secret the characterisation specs sign their tokens with when AUTH_TEST_JWT_SECRET is unset (tests/parity/fixtures/users.ts). */
export const DEFAULT_TEST_JWT_SECRET = 'dreamhouse-characterisation';

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/**
 * Reads the claims of an HS256 bearer token signed with `secret` (the test tokens; the Cognito
 * JWKS verifier of UNT3-20 replaces this for RS256 tokens). Returns `null` without an
 * `Authorization: Bearer` header and throws 401 on a malformed, badly signed or expired token.
 */
export function readBearerClaims(
  authorization: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): BearerClaims | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) throw new UnauthorizedException('malformed Authorization header');
  const parts = match[1].split('.');
  if (parts.length !== 3) throw new UnauthorizedException('malformed bearer token');
  const [header, payload, signature] = parts;

  let alg: unknown;
  let claims: Record<string, unknown>;
  try {
    alg = (decodeSegment(header) as { alg?: unknown }).alg;
    claims = decodeSegment(payload) as Record<string, unknown>;
  } catch {
    throw new UnauthorizedException('malformed bearer token');
  }
  if (alg !== 'HS256')
    throw new UnauthorizedException(`unsupported token algorithm ${String(alg)}`);

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new UnauthorizedException('invalid token signature');
  }
  if (typeof claims.exp === 'number' && claims.exp <= nowSeconds) {
    throw new UnauthorizedException('token expired');
  }

  const groups = claims['cognito:groups'];
  return {
    sub: typeof claims.sub === 'string' ? claims.sub : undefined,
    username: typeof claims.username === 'string' ? claims.username : undefined,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    groups: Array.isArray(groups) ? groups.filter((g): g is string => typeof g === 'string') : [],
  };
}
