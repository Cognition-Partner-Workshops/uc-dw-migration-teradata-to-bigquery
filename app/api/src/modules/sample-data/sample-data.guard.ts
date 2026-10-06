import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ADMIN_GROUP,
  DEFAULT_TEST_JWT_SECRET,
  readBearerClaims,
} from '../../common/auth/bearer-claims';
import { AppConfigService } from '../../config/app-config.service';
import { SampleDataPolicy } from './sample-data.policy';

/**
 * `POST /sample-data/import` is admin-only (Settings tab: `dreamhouse_admin` permission set ->
 * `dreamhouse-admin` Cognito group) and fenced by {@link SampleDataPolicy}. Until the Cognito
 * verifier of UNT3-20 lands, only HS256 tokens signed with AUTH_TEST_JWT_SECRET can be checked;
 * where no such secret applies (production) the guard refuses rather than trust unverified claims.
 */
@Injectable()
export class SampleDataImportGuard implements CanActivate {
  constructor(
    private readonly policy: SampleDataPolicy,
    private readonly config: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.policy.enabled) throw new ForbiddenException(this.policy.disabledReason);

    const secret =
      this.config.get('AUTH_TEST_JWT_SECRET') ??
      (this.config.isProduction ? undefined : DEFAULT_TEST_JWT_SECRET);
    if (!secret) {
      throw new ForbiddenException(
        'sample data import needs a verified dreamhouse-admin token; token verification is not configured here (UNT3-20)',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const claims = readBearerClaims(request.headers.authorization, secret);
    if (!claims) throw new UnauthorizedException('bearer token required');
    if (!claims.groups.includes(ADMIN_GROUP)) {
      throw new ForbiddenException(`${ADMIN_GROUP} group required`);
    }
    return true;
  }
}
