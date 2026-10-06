#!/usr/bin/env node
// Regenerates src/api/schema.d.ts (typed paths/components for openapi-fetch) from the
// Dreamhouse API's committed OpenAPI document. Usage:
//   npm run api:generate                         # from ../api/openapi/openapi.json
//   npm run api:generate -- http://localhost:3000/openapi.json
//   npm run api:generate -- --check              # exit 1 if the committed file is stale (CI)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const check = args.includes('--check');
const source =
  args.find((a) => !a.startsWith('--')) ?? resolve(here, '../../api/openapi/openapi.json');
const outFile = resolve(here, '../src/api/schema.d.ts');

const input = /^https?:\/\//.test(source) ? new URL(source) : new URL(`file://${resolve(source)}`);
// defaultNonNullable: a `default` in the document does not make a request field required for the client
const ast = await openapiTS(input, {
  alphabetize: true,
  exportType: true,
  defaultNonNullable: false,
});
const header = `/* eslint-disable */\n// GENERATED FILE — do not edit. Regenerate with \`npm run api:generate\` (source: app/api/openapi/openapi.json).\n`;
const output = header + astToString(ast);

if (check) {
  let current = '';
  try {
    current = readFileSync(outFile, 'utf8');
  } catch {
    // missing file is stale
  }
  if (current !== output) {
    console.error(`${outFile} is out of date with ${source}. Run \`npm run api:generate\`.`);
    process.exit(1);
  }
  console.log(`${outFile} is up to date.`);
} else {
  writeFileSync(outFile, output);
  console.log(`Wrote ${outFile} from ${source}`);
}
