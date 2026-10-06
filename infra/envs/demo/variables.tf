variable "aws_region" {
  description = "AWS region of the demo environment"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Value of the `project` tag on every resource"
  type        = string
  default     = "salesforce-to-aws-demo"
}

variable "environment" {
  description = "Environment name (one root module per environment)"
  type        = string
  default     = "demo"
}

variable "name" {
  description = "Short prefix for resource names (ALB/target group names are limited to 32 characters)"
  type        = string
  default     = "sf2aws-demo"
}

variable "vpc_cidr" {
  description = "CIDR of the demo VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "availability_zones" {
  description = "Two AZs: one public + one private subnet each"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1d"] # db.t4g.micro/gp3 is not orderable in every AZ (us-east-1b is not); check with aws rds describe-orderable-db-instance-options
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL major version (minor upgrades are automatic)"
  type        = string
  default     = "16"
}

variable "db_password_version" {
  description = "Bump to rotate the database master password (ephemeral, never stored in state)"
  type        = number
  default     = 1
}

variable "api_image_tag" {
  description = "Tag of the API image in ECR that the ECS service runs (`make push` publishes it)"
  type        = string
  default     = "latest"
}

variable "api_desired_count" {
  description = "Number of API tasks"
  type        = number
  default     = 1
}

variable "api_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256
}

variable "api_memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 512
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for the API and RDS log groups"
  type        = number
  default     = 14
}

variable "cognito_groups" {
  description = "Cognito user-pool groups mirroring the Salesforce permission sets (group name -> description)"
  type        = map(string)
  default = {
    dreamhouse       = "Mirrors the Salesforce permission set `dreamhouse`: access to the Dreamhouse app, Property__c/Broker__c CRUD, PropertyController/PagedResult/SampleDataController."
    dreamhouse-admin = "Demo-only superset of `dreamhouse`: Settings page, sample-data import and file administration (System Administrator profile in the org)."
  }
}

variable "csp_image_sources" {
  description = "Extra `img-src` origins for the SPA Content-Security-Policy (the Salesforce CSP trusted sites)"
  type        = list(string)
  default = [
    "https://tile.openstreetmap.org",
    "https://*.tile.openstreetmap.org",
    "https://s3-us-west-2.amazonaws.com",
  ]
}

variable "github_repository" {
  description = "owner/repo whose GitHub Actions workflows may assume the CI/CD roles (OIDC)"
  type        = string
  default     = "Cognition-Partner-Workshops/uc-dw-migration-teradata-to-bigquery"
}

variable "github_branch" {
  description = "Branch whose pushes deploy the demo"
  type        = string
  default     = "salesforce-to-aws-demo"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub OIDC provider instead of using the account's existing one"
  type        = bool
  default     = false
}
