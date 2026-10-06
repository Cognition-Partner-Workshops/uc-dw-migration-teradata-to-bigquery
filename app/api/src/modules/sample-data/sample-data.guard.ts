import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { SampleDataPolicy } from './sample-data.policy';

/**
 * Deployment fence for `POST /sample-data/import` ({@link SampleDataPolicy}: SAMPLE_DATA_IMPORT_ENABLED).
 * Who may call it (`dreamhouse-admin`) is decided by the global AuthGuard/PermissionsGuard through the
 * route's `@RequirePermission('sampleData.invoke', ...)`, which run before this guard.
 */
@Injectable()
export class SampleDataImportGuard implements CanActivate {
  constructor(private readonly policy: SampleDataPolicy) {}

  canActivate(): boolean {
    if (!this.policy.enabled) throw new ForbiddenException(this.policy.disabledReason);
    return true;
  }
}
