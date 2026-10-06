// Same defaults app/api/vitest.setup.ts uses, plus the local Postgres from
// app/api/.env.example so `npm test` works after `prisma migrate deploy`.
process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.DATABASE_URL ??=
  'postgresql://dreamhouse:dreamhouse@localhost:5432/dreamhouse?schema=public';
process.env.GEOCODING_BASE_URL ??= 'https://nominatim.openstreetmap.org/search?format=json';
// Apex `Test.setMock(HttpCalloutMock.class, ...)` is per test method; the ported service caches
// Nominatim answers and paces requests 1/s, which would leak between specs — turn both off here.
process.env.GEOCODING_CACHE_TTL_SECONDS ??= '0';
process.env.GEOCODING_MIN_INTERVAL_MS ??= '0';
