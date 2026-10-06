#!/usr/bin/env bash
# Create the Terraform remote-state backend (S3 bucket, versioned + encrypted + private, and the
# DynamoDB lock table). Idempotent: re-running on an existing backend changes nothing.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
requireAws

tags="TagSet=[{Key=project,Value=$PROJECT_TAG},{Key=environment,Value=shared},{Key=managed_by,Value=bootstrap-backend.sh}]"

if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
  log "state bucket s3://$STATE_BUCKET exists"
else
  log "creating state bucket s3://$STATE_BUCKET"
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$STATE_BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$STATE_BUCKET" --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
  fi
fi
aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$STATE_BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
aws s3api put-public-access-block --bucket "$STATE_BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-tagging --bucket "$STATE_BUCKET" --tagging "$tags"

if aws dynamodb describe-table --table-name "$LOCK_TABLE" >/dev/null 2>&1; then
  log "lock table $LOCK_TABLE exists"
else
  log "creating lock table $LOCK_TABLE"
  aws dynamodb create-table --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --tags "Key=project,Value=$PROJECT_TAG" Key=environment,Value=shared Key=managed_by,Value=bootstrap-backend.sh >/dev/null
  aws dynamodb wait table-exists --table-name "$LOCK_TABLE"
fi
log "backend ready: s3://$STATE_BUCKET + dynamodb://$LOCK_TABLE"
