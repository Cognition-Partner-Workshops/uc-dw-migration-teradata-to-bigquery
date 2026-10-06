import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/load-config';

const baseEnv = { DATABASE_URL: 'postgresql://u:p@db:5432/app' };
const neverFetch = async () => {
  throw new Error('Secrets Manager should not be called');
};

describe('loadConfig', () => {
  it('applies defaults and coerces numbers from the environment', async () => {
    const config = await loadConfig({ ...baseEnv, PORT: '8080' }, neverFetch);
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      PORT: 8080,
      LOG_LEVEL: 'info',
      DATABASE_URL: baseEnv.DATABASE_URL,
      AWS_REGION: 'us-east-1',
    });
  });

  it('rejects an invalid configuration with a readable message', async () => {
    const error = await loadConfig({ PORT: 'abc' }, neverFetch).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^Invalid configuration: /);
    expect((error as Error).message).toContain('DATABASE_URL');
    expect((error as Error).message).toContain('PORT');
  });

  it('merges a Secrets Manager JSON secret, with environment variables taking precedence', async () => {
    const calls: [string, string][] = [];
    const fetchSecrets = async (id: string, region: string) => {
      calls.push([id, region]);
      return {
        DATABASE_URL: 'postgresql://from:secret@rds:5432/app',
        LOG_LEVEL: 'warn',
        PORT: '9000',
      };
    };
    const config = await loadConfig(
      { AWS_SECRETS_MANAGER_SECRET_ID: 'dreamhouse/api', AWS_REGION: 'eu-west-1', PORT: '3001' },
      fetchSecrets,
    );
    expect(calls).toEqual([['dreamhouse/api', 'eu-west-1']]);
    expect(config.DATABASE_URL).toBe('postgresql://from:secret@rds:5432/app');
    expect(config.LOG_LEVEL).toBe('warn');
    expect(config.PORT).toBe(3001);
  });

  it('ignores unrelated environment variables', async () => {
    const config = await loadConfig({ ...baseEnv, HOME: '/root', PATH: '/bin' }, neverFetch);
    expect(config).not.toHaveProperty('HOME');
  });
});
