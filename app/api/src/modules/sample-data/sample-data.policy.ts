import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';

const MANAGED_DATABASE_HOST = /\.rds\.amazonaws\.com$/i;

/**
 * Whether `SampleDataController.importSampleData` may run here. In Salesforce it was gated by the
 * Settings tab permissions only; here it wipes properties/brokers/contacts, so it is off against
 * production and against an RDS endpoint unless SAMPLE_DATA_IMPORT_ENABLED is set explicitly.
 */
@Injectable()
export class SampleDataPolicy {
  constructor(private readonly config: AppConfigService) {}

  get enabled(): boolean {
    const flag = this.config.get('SAMPLE_DATA_IMPORT_ENABLED');
    if (flag !== undefined) return flag;
    if (this.config.isProduction) return false;
    return !this.isManagedDatabase(this.config.get('DATABASE_URL'));
  }

  get disabledReason(): string {
    return (
      'sample data import is disabled on this deployment (it deletes every property, broker and contact); ' +
      'set SAMPLE_DATA_IMPORT_ENABLED=true to allow it'
    );
  }

  private isManagedDatabase(databaseUrl: string): boolean {
    try {
      return MANAGED_DATABASE_HOST.test(new URL(databaseUrl).hostname);
    } catch {
      return false;
    }
  }
}
