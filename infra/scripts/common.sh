# shellcheck shell=bash
# Shared helpers for the infra scripts (sourced, not executed).
# Names of the remote-state backend. Keep in sync with envs/demo/backend.tf.
STATE_BUCKET="${STATE_BUCKET:-sf2aws-tfstate-599083837640}"
LOCK_TABLE="${LOCK_TABLE:-sf2aws-tflock}"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION"
PROJECT_TAG="${PROJECT_TAG:-salesforce-to-aws-demo}"

infraDir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC2034  # used by the sourcing scripts
repoDir="$(cd "$infraDir/.." && pwd)"
envDir="$infraDir/envs/${ENVIRONMENT:-demo}"

log() { printf '\033[36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31merror: %s\033[0m\n' "$*" >&2; exit 1; }

tfOutput() { terraform -chdir="$envDir" output -raw "$1"; }

requireAws() {
  command -v aws >/dev/null || die "aws CLI not found"
  local account
  account="$(aws sts get-caller-identity --query Account --output text)" || die "AWS credentials not usable (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)"
  [[ "$account" == "599083837640" ]] || die "credentials belong to account $account, expected 599083837640"
}
