import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createApp } from '../src/app.factory';
import { buildOpenApiDocument } from '../src/openapi/openapi';

process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.DATABASE_URL ??= 'postgresql://export:export@localhost:5432/export';

async function main(): Promise<void> {
  const outFile = resolve(process.argv[2] ?? 'openapi/openapi.json');
  const app = await createApp();
  await app.init();
  const document = buildOpenApiDocument(app);
  await app.close();

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(document, null, 2) + '\n');
  console.log(
    `OpenAPI ${document.openapi} written to ${outFile} (${Object.keys(document.paths).length} paths)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
