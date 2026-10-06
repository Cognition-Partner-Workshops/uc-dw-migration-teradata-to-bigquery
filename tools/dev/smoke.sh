#!/usr/bin/env bash
# Smoke checks for the local docker-compose stack (`make smoke`, also the first half of `make e2e`).
# Needs curl on the host. API_PORT / WEB_PORT default to 3000 / 5173.
set -euo pipefail

apiBase="http://localhost:${API_PORT:-3000}"
webBase="http://localhost:${WEB_PORT:-5173}"
failures=0

check() {
  local name="$1" url="$2" expect="$3"
  local body
  if body="$(curl -fsS --max-time 10 "$url" 2>&1)" && grep -q -- "$expect" <<<"$body"; then
    printf '  ok   %-28s %s\n' "$name" "$url"
  else
    printf '  FAIL %-28s %s\n' "$name" "$url"
    printf '       expected to contain: %s\n       got: %.300s\n' "$expect" "$body"
    failures=$((failures + 1))
  fi
}

echo "Smoke-checking API ${apiBase} and web ${webBase}"
check "API liveness" "${apiBase}/health" '"status":"ok"'
check "API readiness (db)" "${apiBase}/health/ready" '"database":"up"'
check "API OpenAPI document" "${apiBase}/openapi.json" '"title":"Dreamhouse API"'
check "Web shell" "${webBase}/" '<div id="root">'
check "Web -> API proxy (/api)" "${webBase}/api/health/ready" '"database":"up"'

if (( failures > 0 )); then
  echo "${failures} smoke check(s) failed"
  exit 1
fi
echo "All smoke checks passed"
