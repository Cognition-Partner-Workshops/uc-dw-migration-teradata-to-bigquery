# Remote state: S3 bucket + DynamoDB lock table, both created by `make bootstrap`
# (infra/scripts/bootstrap-backend.sh). Backend blocks cannot use variables, so the names are
# repeated here and in the script (STATE_BUCKET / LOCK_TABLE).
terraform {
  backend "s3" {
    bucket         = "sf2aws-tfstate-599083837640"
    key            = "demo/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "sf2aws-tflock"
    encrypt        = true
  }
}
