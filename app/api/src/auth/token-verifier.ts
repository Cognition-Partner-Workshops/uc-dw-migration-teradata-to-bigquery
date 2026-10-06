import { Injectable, Logger } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { AppConfigService } from '../config/app-config.service';
import {
  resolveAuthConfig,
  stubGroups,
  type AuthMode,
  type ResolvedAuthConfig,
} from './auth.config';
import { InvalidSessionException } from './auth.exceptions';
import type { Principal } from './principal';

export const STUB_TOKEN_PREFIX = 'stub-token-for-';

function groupsClaim(payload: JWTPayload): string[] {
  const groups = payload['cognito:groups'];
  if (Array.isArray(groups)) return groups.filter((g): g is string => typeof g === 'string');
  if (typeof groups === 'string')
    return groups
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
  return [];
}

function principalFromPayload(payload: JWTPayload): Principal {
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new InvalidSessionException('Token has no subject');
  }
  const username =
    (typeof payload.username === 'string' && payload.username) ||
    (typeof payload['cognito:username'] === 'string' && payload['cognito:username']) ||
    payload.sub;
  return {
    sub: payload.sub,
    username,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    groups: groupsClaim(payload),
  };
}

/** Bearer token → Principal, per AUTH_MODE (see auth.config.ts). */
@Injectable()
export class TokenVerifier {
  private readonly logger = new Logger(TokenVerifier.name);
  private readonly auth: ResolvedAuthConfig;
  private jwks?: JWTVerifyGetKey;

  constructor(config: AppConfigService) {
    this.auth = resolveAuthConfig(config.all);
    if (this.auth.mode !== 'cognito') {
      this.logger.warn(
        `AUTH_MODE=${this.auth.mode}: bearer tokens are not verified against Cognito`,
      );
    }
  }

  get mode(): AuthMode {
    return this.auth.mode;
  }

  async verify(token: string): Promise<Principal> {
    switch (this.auth.mode) {
      case 'cognito':
        return this.verifyCognito(token);
      case 'test':
        return this.verifyTestToken(token);
      case 'stub':
        return TokenVerifier.verifyStubToken(token);
    }
  }

  /** Cognito access token: RS256 against the pool's JWKS, `iss` = pool, `client_id` = app client, `token_use` = access. */
  private async verifyCognito(token: string): Promise<Principal> {
    const cognito = this.auth.cognito!;
    this.jwks ??= createRemoteJWKSet(new URL(cognito.jwksUrl));
    const { payload } = await this.verified(() =>
      jwtVerify(token, this.jwks!, { issuer: cognito.issuer, algorithms: ['RS256'] }),
    );
    if (payload.token_use !== 'access') {
      throw new InvalidSessionException('Expected a Cognito access token');
    }
    if (payload.client_id !== cognito.clientId) {
      throw new InvalidSessionException('Token was not issued for this application');
    }
    return principalFromPayload(payload);
  }

  /** HS256 token minted by the test fixtures (`System.runAs`). */
  private async verifyTestToken(token: string): Promise<Principal> {
    const test = this.auth.test!;
    const { payload } = await this.verified(() =>
      jwtVerify(token, new TextEncoder().encode(test.secret), {
        issuer: test.issuer,
        algorithms: ['HS256'],
      }),
    );
    return principalFromPayload(payload);
  }

  /** `stub-token-for-<username>` from the web stub auth client; groups by username convention. */
  static verifyStubToken(token: string): Principal {
    if (!token.startsWith(STUB_TOKEN_PREFIX)) {
      throw new InvalidSessionException('Expected a stub token (AUTH_MODE=stub)');
    }
    const username = token.slice(STUB_TOKEN_PREFIX.length).trim();
    if (!username) throw new InvalidSessionException('Stub token has no username');
    return {
      sub: `stub-${username}`,
      username,
      email: username.includes('@') ? username : undefined,
      groups: stubGroups(username),
    };
  }

  private async verified<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof InvalidSessionException) throw error;
      this.logger.debug(`Token rejected: ${(error as Error).message}`);
      throw new InvalidSessionException();
    }
  }
}
