#!/usr/bin/env bash
# Build app/api/Dockerfile for linux/amd64 and push it to the ECR repository created by Terraform.
# IMAGE_TAG defaults to the tag the ECS service runs (`latest`); the git SHA is pushed as well.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
requireAws
command -v docker >/dev/null || die "docker not found"

repo="$(tfOutput ecr_repository_url)"
registry="${repo%%/*}"
tag="${IMAGE_TAG:-latest}"
sha="$(git -C "$repoDir" rev-parse --short HEAD 2>/dev/null || echo dev)"

log "logging in to $registry"
aws ecr get-login-password | docker login --username AWS --password-stdin "$registry" >/dev/null

log "building app/api -> $repo:$tag (and :$sha)"
docker build --platform linux/amd64 -t "$repo:$tag" -t "$repo:$sha" "$repoDir/app/api"

log "pushing"
docker push "$repo:$tag"
docker push "$repo:$sha"
log "pushed $repo:$tag ($sha)"
