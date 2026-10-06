#!/usr/bin/env bash
# Acceptance checks of the deployed demo: API /health through the ALB, the SPA through CloudFront,
# the API through CloudFront's /api proxy, and the CSP header. Each check is retried for
# SMOKE_TIMEOUT seconds (default 300: a fresh ECS deployment / CloudFront propagation takes a while).
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

apiUrl="$(tfOutput api_url)"
webUrl="$(tfOutput web_url)"
timeout="${SMOKE_TIMEOUT:-300}"
failures=0

check() {
  local name="$1" url="$2" expect="$3" body deadline=$((SECONDS + timeout))
  while :; do
    if body="$(curl -fsS --max-time 15 "$url" 2>&1)" && grep -q -- "$expect" <<<"$body"; then
      printf '  ok   %-34s %s\n' "$name" "$url"
      return
    fi
    (( SECONDS < deadline )) || break
    sleep 5
  done
  printf '  FAIL %-34s %s\n       expected to contain: %s\n       got: %.300s\n' "$name" "$url" "$expect" "$body"
  failures=$((failures + 1))
}

checkHeader() {
  local name="$1" url="$2" header="$3" expect="$4" value
  value="$(curl -fsSI --max-time 15 "$url" | tr -d '\r' | grep -i "^$header:" || true)"
  if grep -q -- "$expect" <<<"$value"; then
    printf '  ok   %-34s %s: %.80s...\n' "$name" "$header" "${value#*: }"
  else
    printf '  FAIL %-34s %s header missing or unexpected: %s\n' "$name" "$header" "$value"
    failures=$((failures + 1))
  fi
}

log "smoke checks ($apiUrl, $webUrl)"
check "API /health via ALB"             "$apiUrl/health"         '"status":"ok"'
check "API /health/ready via ALB (db)"  "$apiUrl/health/ready"   '"database":"up"'
check "SPA index via CloudFront"        "$webUrl/"               '<div id="root">'
check "SPA deep link via CloudFront"    "$webUrl/properties"     '<div id="root">'
check "API /health via CloudFront /api" "$webUrl/api/health"     '"status":"ok"'
checkHeader "CSP on the SPA" "$webUrl/" "content-security-policy" "img-src 'self' data: blob: https://tile.openstreetmap.org"

if (( failures > 0 )); then
  die "$failures smoke check(s) failed"
fi
log "all smoke checks passed"
