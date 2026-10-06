import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InsufficientAccessException } from './auth.exceptions';
import { IS_PUBLIC, REQUIRED_PERMISSIONS, type RequestWithPrincipal } from './decorators';
import { isPermitted, requiredGroups, type PermissionKey } from './policy';

/**
 * Authorization: the caller's groups must hold `app.access` plus every key the route declares
 * with `@RequirePermission`. Fails closed: a non-public route without a declaration is 403 for
 * everyone (and logged), so a new endpoint cannot ship unguarded.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = request.principal;
    if (!principal) throw new InsufficientAccessException('No principal on the request');

    const declared = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      REQUIRED_PERMISSIONS,
      targets,
    );
    if (!declared) {
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} has no @RequirePermission; denying`,
      );
      throw new InsufficientAccessException('No authorization policy is declared for this route');
    }

    for (const key of ['app.access' as const, ...declared]) {
      if (!isPermitted(principal.groups, key)) {
        const groups = requiredGroups(key);
        throw new InsufficientAccessException(
          `Insufficient access: ${key} requires group ${groups.join(' or ') || '(none)'}`,
          { permission: key, requiredGroups: groups },
        );
      }
    }
    return true;
  }
}
