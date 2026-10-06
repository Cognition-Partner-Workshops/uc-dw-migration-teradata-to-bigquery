import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * `make seed` / `npm run seed`: load the migrated data set into the database behind DATABASE_URL.
 *
 * The data set is the output of the extract/transform tickets (UNT3-12, UNT3-13), one file per
 * target table under SEED_DIR (default ../../data/migrated, also inside docker-compose). Until the
 * loader lands with UNT3-13 this script checks the database is reachable and migrated, and
 * reports the files waiting to be loaded; it fails rather than pretend data it cannot load
 * was seeded.
 */

interface MigrationState {
  applied: number;
  pending: number;
  tables: string[];
}

const LOADABLE_EXTENSIONS = new Set(['.json', '.csv', '.ndjson']);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (copy .env.example to .env or run through docker-compose)`);
  }
  return value;
}

function listDataFiles(seedDir: string): string[] {
  if (!existsSync(seedDir) || !statSync(seedDir).isDirectory()) {
    return [];
  }
  return readdirSync(seedDir)
    .filter((name) => LOADABLE_EXTENSIONS.has(name.slice(name.lastIndexOf('.')).toLowerCase()))
    .sort();
}

async function readMigrationState(prisma: PrismaClient): Promise<MigrationState> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const tableNames = tables.map((row) => row.tablename);
  if (!tableNames.includes('_prisma_migrations')) {
    return { applied: 0, pending: 0, tables: tableNames };
  }
  const [counts] = await prisma.$queryRaw<{ applied: bigint; pending: bigint }[]>`
    SELECT count(*) FILTER (WHERE finished_at IS NOT NULL) AS applied,
           count(*) FILTER (WHERE finished_at IS NULL) AS pending
    FROM _prisma_migrations WHERE rolled_back_at IS NULL`;
  return {
    applied: Number(counts.applied),
    pending: Number(counts.pending),
    tables: tableNames.filter((name) => name !== '_prisma_migrations'),
  };
}

async function loadDataSet(_prisma: PrismaClient, seedDir: string, files: string[]): Promise<void> {
  // UNT3-13 replaces this with the real loader (brokers, properties, contacts in one transaction).
  throw new Error(
    `found ${files.length} data file(s) in ${seedDir} (${files.join(', ')}) but the loader is not ` +
      'implemented yet (ticket UNT3-13)',
  );
}

async function main(): Promise<void> {
  const seedDir = resolve(process.env.SEED_DIR ?? join(__dirname, '..', '..', '..', 'data', 'migrated'));
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    const state = await readMigrationState(prisma);
    console.log(
      `[seed] database reachable; migrations applied=${state.applied} pending=${state.pending}; ` +
        `tables: ${state.tables.length ? state.tables.join(', ') : '(none yet)'}`,
    );
    if (state.pending > 0) {
      throw new Error(`${state.pending} migration(s) are unfinished; run \`make migrate\` first`);
    }

    const files = listDataFiles(seedDir);
    if (files.length === 0) {
      console.log(`[seed] no data set in ${seedDir}; nothing to load (filled by tickets UNT3-12/13)`);
      return;
    }
    await loadDataSet(prisma, seedDir, files);
    console.log(`[seed] loaded ${files.length} file(s) from ${seedDir}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
