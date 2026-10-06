# `demo` environment of the Salesforce -> React + Postgres on AWS migration (account 599083837640,
# us-east-1). One module per concern; see ../../README.md for the picture and the make targets.

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
}

module "network" {
  source = "../../modules/network"

  name               = var.name
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

module "auth" {
  source = "../../modules/auth"

  name   = var.name
  groups = var.cognito_groups
}

module "files" {
  source = "../../modules/files"

  bucket_name = "${var.name}-files-${local.account_id}"
}

module "database" {
  source = "../../modules/database"

  name                     = var.name
  vpc_id                   = module.network.vpc_id
  subnet_ids               = module.network.private_subnet_ids
  client_security_group_id = module.api.task_security_group_id
  instance_class           = var.db_instance_class
  engine_version           = var.db_engine_version
  password_version         = var.db_password_version
  secret_name              = "${var.project}/${var.environment}/api"
  log_retention_days       = var.log_retention_days
}

module "api" {
  source = "../../modules/api"

  name                = var.name
  project             = var.project
  environment         = var.environment
  aws_region          = var.aws_region
  vpc_id              = module.network.vpc_id
  public_subnet_ids   = module.network.public_subnet_ids
  private_subnet_ids  = module.network.private_subnet_ids
  image_tag           = var.api_image_tag
  desired_count       = var.api_desired_count
  cpu                 = var.api_cpu
  memory              = var.api_memory
  log_retention_days  = var.log_retention_days
  app_secret_arn      = module.database.app_secret_arn
  files_bucket_arn    = module.files.bucket_arn
  files_bucket_name   = module.files.bucket_name
  user_pool_id        = module.auth.user_pool_id
  user_pool_arn       = module.auth.user_pool_arn
  user_pool_client_id = module.auth.user_pool_client_id
}

module "web" {
  source = "../../modules/web"

  name                   = var.name
  bucket_name            = "${var.name}-web-${local.account_id}"
  api_origin_domain_name = module.api.alb_dns_name
  csp_image_sources = concat(var.csp_image_sources, [
    "https://${module.files.bucket_name}.s3.amazonaws.com",
    "https://${module.files.bucket_regional_domain_name}",
  ])
  csp_connect_sources = ["https://cognito-idp.${var.aws_region}.amazonaws.com"]
}
