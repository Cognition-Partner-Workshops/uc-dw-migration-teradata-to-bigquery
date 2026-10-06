import { describe, expect, it } from 'vitest';
import { AppConfigService } from '../../config/app-config.service';
import { SampleDataPolicy } from './sample-data.policy';

function policyFor(values: Record<string, unknown>): SampleDataPolicy {
  const config = {
    get: (key: string) => values[key],
    get isProduction() {
      return values.NODE_ENV === 'production';
    },
  } as unknown as AppConfigService;
  return new SampleDataPolicy(config);
}

const LOCAL = 'postgresql://dreamhouse:dreamhouse@localhost:5432/dreamhouse';
const RDS =
  'postgresql://app:secret@dreamhouse-demo.cluster-abc.us-east-1.rds.amazonaws.com:5432/dreamhouse';

describe('SampleDataPolicy (guard against wiping the demo RDS)', () => {
  it('is on by default for local development and tests', () => {
    expect(policyFor({ NODE_ENV: 'development', DATABASE_URL: LOCAL }).enabled).toBe(true);
    expect(policyFor({ NODE_ENV: 'test', DATABASE_URL: LOCAL }).enabled).toBe(true);
  });

  it('is off by default in production and against an RDS endpoint', () => {
    expect(policyFor({ NODE_ENV: 'production', DATABASE_URL: LOCAL }).enabled).toBe(false);
    expect(policyFor({ NODE_ENV: 'development', DATABASE_URL: RDS }).enabled).toBe(false);
  });

  it('follows SAMPLE_DATA_IMPORT_ENABLED when set explicitly', () => {
    expect(
      policyFor({ NODE_ENV: 'production', DATABASE_URL: RDS, SAMPLE_DATA_IMPORT_ENABLED: true })
        .enabled,
    ).toBe(true);
    expect(
      policyFor({ NODE_ENV: 'development', DATABASE_URL: LOCAL, SAMPLE_DATA_IMPORT_ENABLED: false })
        .enabled,
    ).toBe(false);
  });

  it('treats an unparsable DATABASE_URL as not managed', () => {
    expect(policyFor({ NODE_ENV: 'development', DATABASE_URL: 'nonsense' }).enabled).toBe(true);
  });
});
