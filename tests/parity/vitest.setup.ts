import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Same defaults app/api/vitest.setup.ts uses, plus the local Postgres from
// app/api/.env.example so `npm test` works after `prisma migrate deploy`.
process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'silent';
// The specs mint HS256 tokens (fixtures/users.ts); the compose dev container runs AUTH_MODE=stub.
process.env.AUTH_MODE = 'test';
process.env.DATABASE_URL ??=
  'postgresql://dreamhouse:dreamhouse@localhost:5432/dreamhouse?schema=public';
process.env.GEOCODING_BASE_URL ??= 'https://nominatim.openstreetmap.org/search?format=json';
// Apex `Test.setMock(HttpCalloutMock.class, ...)` is per test method; the ported service caches
// Nominatim answers and paces requests 1/s, which would leak between specs — turn both off here.
process.env.GEOCODING_CACHE_TTL_SECONDS ??= '0';
process.env.GEOCODING_MIN_INTERVAL_MS ??= '0';
// FileUtilities.createFile writes the file body to the S3 bucket in AWS; here a scratch directory
// stands in (FilesModule falls back to LocalFileStorage when FILES_BUCKET is unset).
delete process.env.FILES_BUCKET;
process.env.FILES_LOCAL_DIR ??= mkdtempSync(join(tmpdir(), 'dreamhouse-parity-files-'));
