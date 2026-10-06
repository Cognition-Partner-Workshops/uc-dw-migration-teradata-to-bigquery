#!/usr/bin/env bash
# Delete the remote-state backend after `make destroy`: empties the versioned state bucket
# (all versions and delete markers), deletes it and the lock table. Refuses to run while the
# state file still describes resources.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
requireAws

if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
  if aws s3api head-object --bucket "$STATE_BUCKET" --key "demo/terraform.tfstate" >/dev/null 2>&1; then
    resources="$(aws s3 cp "s3://$STATE_BUCKET/demo/terraform.tfstate" - | python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("resources", [])))')"
    [[ "$resources" == "0" ]] || die "the demo state still holds $resources resources; run 'make destroy' first"
  fi
  log "emptying s3://$STATE_BUCKET (all object versions)"
  aws s3api list-object-versions --bucket "$STATE_BUCKET" --output json \
    --query '{Objects: [Versions[].{Key:Key,VersionId:VersionId}, DeleteMarkers[].{Key:Key,VersionId:VersionId}][] | [0:1000]}' \
    > /tmp/sf2aws-versions.json
  while [[ "$(python3 -c 'import json; print(len(json.load(open("/tmp/sf2aws-versions.json")).get("Objects") or []))')" != "0" ]]; do
    aws s3api delete-objects --bucket "$STATE_BUCKET" --delete "file:///tmp/sf2aws-versions.json" --query 'length(Deleted)' --output text
    aws s3api list-object-versions --bucket "$STATE_BUCKET" --output json \
      --query '{Objects: [Versions[].{Key:Key,VersionId:VersionId}, DeleteMarkers[].{Key:Key,VersionId:VersionId}][] | [0:1000]}' \
      > /tmp/sf2aws-versions.json
  done
  log "deleting s3://$STATE_BUCKET"
  aws s3api delete-bucket --bucket "$STATE_BUCKET"
else
  log "state bucket $STATE_BUCKET does not exist"
fi

if aws dynamodb describe-table --table-name "$LOCK_TABLE" >/dev/null 2>&1; then
  log "deleting lock table $LOCK_TABLE"
  aws dynamodb delete-table --table-name "$LOCK_TABLE" >/dev/null
else
  log "lock table $LOCK_TABLE does not exist"
fi
log "backend removed"
