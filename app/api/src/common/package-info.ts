import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface PackageInfo {
  name: string;
  version: string;
  description: string;
}

function findPackageJson(startDir: string): string {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('package.json not found above ' + startDir);
    dir = parent;
  }
}

/** Works from both `src/` (ts-node, vitest) and `dist/` (compiled) without importing package.json into the TS program. */
export const packageInfo: PackageInfo = JSON.parse(
  readFileSync(findPackageJson(__dirname), 'utf8'),
);
