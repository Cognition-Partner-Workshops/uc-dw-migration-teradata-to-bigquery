import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
// The specs mint HS256 tokens (test/support/test-users.ts); the compose dev container runs AUTH_MODE=stub.
process.env.AUTH_MODE = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:1/test';
delete process.env.AWS_SECRETS_MANAGER_SECRET_ID;
process.env.FILES_LOCAL_DIR ??= mkdtempSync(join(tmpdir(), 'dreamhouse-files-'));
delete process.env.FILES_BUCKET;
