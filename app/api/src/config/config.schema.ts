import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url(),
  GEOCODING_BASE_URL: z
    .string()
    .url()
    .default('https://nominatim.openstreetmap.org/search?format=json'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_SECRETS_MANAGER_SECRET_ID: z.string().optional(),
});

export type RawConfig = z.input<typeof configSchema>;
export type AppConfig = z.output<typeof configSchema>;

export const CONFIG_KEYS = Object.keys(configSchema.shape) as (keyof AppConfig)[];
