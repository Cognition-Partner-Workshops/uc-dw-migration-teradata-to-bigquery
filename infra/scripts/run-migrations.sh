#!/usr/bin/env bash
# Run the Prisma migrations against the demo database as a one-off ECS Fargate task (task
# definition `<name>-api-migrate`, image tag `migrate`, same subnets/security group/secret as the
# API), wait for it to stop, print its log and fail if it did not exit 0.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
requireAws

cluster="$(tfOutput ecs_cluster_name)"
family="$(tfOutput ecs_migrate_task_family)"
securityGroup="$(tfOutput api_task_security_group_id)"
logGroup="$(tfOutput api_log_group)"
subnets="$(terraform -chdir="$envDir" output -json api_private_subnet_ids | python3 -c 'import json,sys; print(",".join(json.load(sys.stdin)))')"

log "running $family on $cluster (private subnets, no public IP)"
run="$(aws ecs run-task --cluster "$cluster" --task-definition "$family" --launch-type FARGATE --count 1 \
  --network-configuration "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroup],assignPublicIp=DISABLED}" \
  --output json)"
failures="$(printf '%s' "$run" | python3 -c 'import json,sys; print("; ".join("%s: %s" % (f.get("arn"), f.get("reason")) for f in json.load(sys.stdin)["failures"]))')"
[[ -z "$failures" ]] || die "ecs run-task failed: $failures"
taskArn="$(printf '%s' "$run" | python3 -c 'import json,sys; print(json.load(sys.stdin)["tasks"][0]["taskArn"])')"
taskId="${taskArn##*/}"
log "task $taskId started; waiting for it to stop (up to ~10 min)"
aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$taskArn"

describe="$(aws ecs describe-tasks --cluster "$cluster" --tasks "$taskArn" --output json)"
read -r exitCode stoppedReason < <(printf '%s' "$describe" | python3 -c '
import json, sys
task = json.load(sys.stdin)["tasks"][0]
container = task["containers"][0]
print(container.get("exitCode", "none"), (container.get("reason") or task.get("stoppedReason") or "-").replace("\n", " "))')

log "migration log ($logGroup migrate/migrate/$taskId)"
aws logs get-log-events --log-group-name "$logGroup" --log-stream-name "migrate/migrate/$taskId" \
  --start-from-head --query 'events[].message' --output json 2>/dev/null \
  | python3 -c 'import json,sys; print("\n".join("    " + m for m in json.load(sys.stdin)))' || echo "    (no log events)"

[[ "$exitCode" == "0" ]] || die "migration task exited with $exitCode ($stoppedReason)"
log "migrations applied"
