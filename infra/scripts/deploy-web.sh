#!/usr/bin/env bash
# Build the React app (app/web) against the deployed API and Cognito pool, upload it to the web
# bucket and invalidate CloudFront. Builds inside node:22-alpine when node is not installed.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
requireAws

bucket="$(tfOutput web_bucket)"
distribution="$(tfOutput cloudfront_distribution_id)"
userPoolId="$(tfOutput cognito_user_pool_id)"
clientId="$(tfOutput cognito_user_pool_client_id)"
webDir="$repoDir/app/web"

# All of these end up in the browser bundle; none is a secret (Cognito SPA client has no secret).
export VITE_API_BASE_URL=/api
export VITE_AUTH_MODE="${VITE_AUTH_MODE:-cognito}"
export VITE_COGNITO_REGION="$AWS_REGION"
export VITE_COGNITO_USER_POOL_ID="$userPoolId"
export VITE_COGNITO_CLIENT_ID="$clientId"

log "building app/web (VITE_AUTH_MODE=$VITE_AUTH_MODE, pool $userPoolId)"
if command -v node >/dev/null && [[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]]; then
  (cd "$webDir" && npm ci --no-audit --no-fund && npm run build)
else
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/npm-cache \
    -e VITE_API_BASE_URL -e VITE_AUTH_MODE -e VITE_COGNITO_REGION -e VITE_COGNITO_USER_POOL_ID -e VITE_COGNITO_CLIENT_ID \
    -v "$webDir:/web" -w /web node:22-alpine sh -c 'npm ci --no-audit --no-fund && npm run build'
fi

log "uploading dist/ to s3://$bucket"
# hashed assets: cache for a year; everything else (index.html, icons): revalidate every time
aws s3 sync "$webDir/dist/assets" "s3://$bucket/assets" --only-show-errors --delete --cache-control "public,max-age=31536000,immutable"
aws s3 sync "$webDir/dist" "s3://$bucket" --only-show-errors --delete --exclude "assets/*" --cache-control "no-cache"

log "invalidating CloudFront $distribution"
invalidation="$(aws cloudfront create-invalidation --distribution-id "$distribution" --paths "/*" --query 'Invalidation.Id' --output text)"
aws cloudfront wait invalidation-completed --distribution-id "$distribution" --id "$invalidation"
log "web deployed: $(tfOutput web_url)"
