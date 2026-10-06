#!/bin/sh
# Entrypoint of the docker-compose dev container (see app/api/Dockerfile.dev).
# 1. Reinstall dependencies when package-lock.json differs from what node_modules was built from.
# 2. Regenerate the Prisma client (src/generated/ is git-ignored and lives on the bind mount).
# 3. Run the given command (default: `npm run start:dev`, i.e. nest --watch).
set -eu
cd "$(dirname "$0")/.."

if ! sha256sum -cs node_modules/.package-lock.sha256 2>/dev/null; then
  echo "[dev-entrypoint] package-lock.json changed since node_modules was installed -> npm ci"
  npm ci --ignore-scripts
  sha256sum package-lock.json > node_modules/.package-lock.sha256
fi

npx prisma generate >/dev/null
exec "$@"
