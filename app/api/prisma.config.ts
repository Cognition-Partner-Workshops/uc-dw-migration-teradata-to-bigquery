import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` must work without a database (CI, Docker build); only
// `prisma migrate` / `prisma studio` actually connect, and they require DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
