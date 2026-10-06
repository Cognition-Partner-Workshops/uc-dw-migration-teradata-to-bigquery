import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { PermissionKey, SfObject } from './policy';
import type { Principal } from './principal';

export const IS_PUBLIC = 'auth:public';
export const REQUIRED_PERMISSIONS = 'auth:permissions';
export const SF_OBJECT = 'auth:sfObject';

/** No bearer token needed (health probes). Everything else is authenticated by default. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Permission keys (policy.ts) the caller must all hold; `app.access` is implied. A route
 * without this decorator is denied for everyone (fail closed) — see PermissionsGuard.
 */
export const RequirePermission = (...keys: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, keys);

/**
 * The Salesforce object whose field-level security applies to this route: responses are
 * filtered to readable fields, bodies rejected when they write non-editable fields.
 */
export const SfObjectAccess = (object: SfObject) => SetMetadata(SF_OBJECT, object);

export type RequestWithPrincipal = Request & { principal?: Principal };

/** The authenticated caller (`UserInfo` of the request). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal | undefined =>
    ctx.switchToHttp().getRequest<RequestWithPrincipal>().principal,
);
