// Same defaults app/api/vitest.setup.ts uses, plus the local Postgres from
// app/api/.env.example so `npm test` works after `prisma migrate deploy`.
process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.DATABASE_URL ??=
  'postgresql://dreamhouse:dreamhouse@localhost:5432/dreamhouse?schema=public';
process.env.GEOCODING_BASE_URL ??= 'https://nominatim.openstreetmap.org/search?format=json';
