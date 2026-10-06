import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import type { Principal } from './principal';

export interface RequestContext {
  principal?: Principal;
}

/**
 * Per-request store so services can ask "who is running this" without threading the
 * principal through every signature — the equivalent of Apex `UserInfo` / `with sharing`
 * being ambient. Opened by `requestContextMiddleware`, filled by `AuthGuard`.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  requestContext.run({}, () => next());
}

export function setCurrentPrincipal(principal: Principal): void {
  const store = requestContext.getStore();
  if (store) {
    store.principal = principal;
  } else {
    requestContext.enterWith({ principal });
  }
}

/**
 * The principal of the current request, or `undefined` outside one (seed script, sample
 * import batch, unit tests) — which services treat as system context (`without sharing`).
 */
export function currentPrincipal(): Principal | undefined {
  return requestContext.getStore()?.principal;
}
