import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { SF_OBJECT, type RequestWithPrincipal } from './decorators';
import { assertWritable, stripUnreadable } from './field-policy';
import type { SfObject } from './policy';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Field-level security for routes tagged `@SfObjectAccess(object)`: request bodies may not
 * write fields the caller cannot edit (403 before validation), responses only carry fields
 * the caller can read. Routes without the tag (health, geocoding, sample import) pass through.
 */
@Injectable()
export class FieldSecurityInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const object = this.reflector.getAllAndOverride<SfObject | undefined>(SF_OBJECT, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = request.principal;
    if (!object || !principal) return next.handle();

    if (WRITE_METHODS.has(request.method)) {
      assertWritable(request.body, principal.groups, object);
    }
    return next
      .handle()
      .pipe(map((payload: unknown) => stripUnreadable(payload, principal.groups, object)));
  }
}
