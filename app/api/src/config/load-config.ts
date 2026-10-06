import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { AppConfig, CONFIG_KEYS, configSchema } from './config.schema';

type EnvSource = Record<string, string | undefined>;

export interface SecretsFetcher {
  (secretId: string, region: string): Promise<Record<string, string>>;
}

export const fetchSecretsManagerJson: SecretsFetcher = async (secretId, region) => {
  const client = new SecretsManagerClient({ region });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString (binary secrets are not supported)`);
  }
  const parsed: unknown = JSON.parse(response.SecretString);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Secret ${secretId} must be a JSON object of KEY: value pairs`);
  }
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
  );
};

/**
 * Builds the typed application config.
 *
 * Precedence (highest first): process environment -> AWS Secrets Manager JSON secret
 * (when AWS_SECRETS_MANAGER_SECRET_ID is set) -> schema defaults.
 * In Salesforce terms this replaces Custom Metadata / Custom Settings / Named Credentials.
 */
export async function loadConfig(
  env: EnvSource = process.env,
  fetchSecrets: SecretsFetcher = fetchSecretsManagerJson,
): Promise<AppConfig> {
  const fromEnv: EnvSource = {};
  for (const key of CONFIG_KEYS) {
    if (env[key] !== undefined && env[key] !== '') {
      fromEnv[key] = env[key];
    }
  }

  let fromSecrets: Record<string, string> = {};
  const secretId = fromEnv.AWS_SECRETS_MANAGER_SECRET_ID;
  if (secretId) {
    fromSecrets = await fetchSecrets(secretId, fromEnv.AWS_REGION ?? 'us-east-1');
  }

  const result = configSchema.safeParse({ ...fromSecrets, ...fromEnv });
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return result.data;
}

export const CONFIG_NAMESPACE = 'app';

export const configuration = async (): Promise<{ [CONFIG_NAMESPACE]: AppConfig }> => ({
  [CONFIG_NAMESPACE]: await loadConfig(),
});
