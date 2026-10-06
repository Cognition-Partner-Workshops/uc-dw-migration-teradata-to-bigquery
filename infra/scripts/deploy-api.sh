#!/usr/bin/env bash
# Roll the ECS service to the image currently tagged in ECR (force a new deployment) and wait
# until it is stable; then show the task status.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
requireAws

cluster="$(tfOutput ecs_cluster_name)"
service="$(tfOutput ecs_service_name)"

log "forcing a new deployment of $service on $cluster"
aws ecs update-service --cluster "$cluster" --service "$service" --force-new-deployment \
  --query 'service.deployments[0].{status:status,rollout:rolloutState,desired:desiredCount}' --output table

log "waiting for the service to become stable (up to ~10 min)"
aws ecs wait services-stable --cluster "$cluster" --services "$service"
aws ecs describe-services --cluster "$cluster" --services "$service" \
  --query 'services[0].{running:runningCount,desired:desiredCount,deployment:deployments[0].rolloutState}' --output table
