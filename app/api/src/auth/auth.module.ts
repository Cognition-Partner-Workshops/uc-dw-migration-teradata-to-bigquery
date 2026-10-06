import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { FieldSecurityInterceptor } from './field-security.interceptor';
import { PermissionsGuard } from './permissions.guard';
import { TokenVerifier } from './token-verifier';

/**
 * Cognito groups + guard: the `dreamhouse` permission set and `with sharing` for the API.
 * Registered globally so every controller is authenticated (AuthGuard, 401), authorised
 * against policy.ts (PermissionsGuard, 403) and field-filtered (FieldSecurityInterceptor).
 */
@Global()
@Module({
  providers: [
    TokenVerifier,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: FieldSecurityInterceptor },
  ],
  exports: [TokenVerifier],
})
export class AuthModule {}
