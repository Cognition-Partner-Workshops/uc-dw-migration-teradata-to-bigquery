#!/bin/sh
# Entrypoint of the docker-compose dev container (see app/web/Dockerfile.dev).
# Reinstalls dependencies when package-lock.json differs from what node_modules was built
# from, then runs the given command (default: the Vite dev server).
set -eu
cd "$(dirname "$0")/.."

if ! sha256sum -cs node_modules/.package-lock.sha256 2>/dev/null; then
  echo "[dev-entrypoint] package-lock.json changed since node_modules was installed -> npm ci"
  npm ci
  sha256sum package-lock.json > node_modules/.package-lock.sha256
fi

exec "$@"
