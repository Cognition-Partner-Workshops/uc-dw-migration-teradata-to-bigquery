import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InvalidSessionException } from './auth.exceptions';
import { IS_PUBLIC, type RequestWithPrincipal } from './decorators';
import { setCurrentPrincipal } from './request-context';
import { TokenVerifier } from './token-verifier';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Authentication: every route needs `Authorization: Bearer <token>` unless marked `@Public()`.
 * On success the Principal is attached to the request and the request context; otherwise 401.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? BEARER.exec(header) : null;
    if (!match) throw new InvalidSessionException();

    const principal = await this.tokens.verify(match[1]);
    request.principal = principal;
    setCurrentPrincipal(principal);
    return true;
  }
}
