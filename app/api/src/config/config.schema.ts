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
  // Salesforce Files (ContentVersion.VersionData) live in the private S3 bucket of infra/modules/files.
  // Unset -> objects are kept on local disk under FILES_LOCAL_DIR (docker-compose / tests).
  FILES_BUCKET: z.string().min(1).optional(),
  FILES_LOCAL_DIR: z.string().min(1).default('.data/files'),
  // Largest body FileUtilities.createFile accepts inline (decoded bytes); larger files go through the
  // pre-signed upload (POST /files/presigned-upload). Apex capped base64 request bodies at ~6 MB.
  FILES_MAX_INLINE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(6 * 1024 * 1024),
  FILES_PRESIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  // SampleDataController.importSampleData wipes the data set: outside NODE_ENV=production it is on by
  // default; against the demo RDS it must be enabled explicitly ('true' / '1').
  SAMPLE_DATA_IMPORT_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .transform((value) => value === 'true' || value === '1')
    .optional(),
  // HS256 secret of the bearer tokens the characterisation specs mint (tests/parity/fixtures/users.ts);
  // only honoured outside production. The Cognito JWKS verifier arrives with UNT3-20.
  AUTH_TEST_JWT_SECRET: z.string().min(1).optional(),
});

export type RawConfig = z.input<typeof configSchema>;
export type AppConfig = z.output<typeof configSchema>;

export const CONFIG_KEYS = Object.keys(configSchema.shape) as (keyof AppConfig)[];
