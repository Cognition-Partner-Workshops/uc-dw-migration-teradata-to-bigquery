import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url(),
  // GeocodingService callout (Apex Remote Site Setting nominatim_openstreetmap).
  GEOCODING_BASE_URL: z
    .string()
    .url()
    .default('https://nominatim.openstreetmap.org/search?format=json'),
  // Nominatim's usage policy requires a User-Agent that identifies the application.
  GEOCODING_USER_AGENT: z
    .string()
    .min(1)
    .default('dreamhouse-api (Salesforce dreamhouse-lwc port; contact via the repository)'),
  // Apex sent `http-referer: URL.getOrgDomainUrl()`; optional here.
  GEOCODING_REFERER: z.string().url().optional(),
  GEOCODING_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  // Extra attempts after the first one, on network errors / timeouts / 429 / 5xx only.
  GEOCODING_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  // Nominatim usage policy: at most 1 request per second (0 disables the limiter, e.g. against a self-hosted instance).
  GEOCODING_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(1000),
  // Nominatim usage policy: cache results. 0 disables the cache.
  GEOCODING_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(86_400),
  GEOCODING_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(1000),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_SECRETS_MANAGER_SECRET_ID: z.string().optional(),
  // Authentication (src/auth): how bearer tokens are verified. Defaults per NODE_ENV —
  // production: cognito, test: test (HS256 fixtures), development: stub (web stub client).
  AUTH_MODE: z.enum(['cognito', 'test', 'stub']).optional(),
  // Cognito user pool the ECS task definition passes (infra/modules/api); required when AUTH_MODE=cognito.
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_CLIENT_ID: z.string().min(1).optional(),
  // Region of the pool (defaults to the prefix of the pool id) / full issuer override (local emulators).
  COGNITO_REGION: z.string().min(1).optional(),
  COGNITO_ISSUER: z.string().url().optional(),
  // AUTH_MODE=test: the secret/issuer tests/parity/fixtures/users.ts signs its `System.runAs` tokens with.
  AUTH_TEST_JWT_SECRET: z.string().min(1).default('dreamhouse-characterisation'),
  AUTH_TEST_ISSUER: z
    .string()
    .url()
    .default('https://cognito-idp.us-east-1.amazonaws.com/dreamhouse-test'),
});

export type RawConfig = z.input<typeof configSchema>;
export type AppConfig = z.output<typeof configSchema>;

export const CONFIG_KEYS = Object.keys(configSchema.shape) as (keyof AppConfig)[];
