variable "name" {
  type = string
}

variable "github_repository" {
  description = "owner/repo whose workflows may assume the roles"
  type        = string
}

variable "github_branch" {
  description = "Branch whose pushes may assume the deploy role (and plan)"
  type        = string
}

variable "create_oidc_provider" {
  description = "Create the token.actions.githubusercontent.com provider (false: look up the account's existing one)"
  type        = bool
  default     = false
}

variable "state_bucket" {
  type = string
}

variable "state_key" {
  type = string
}

variable "lock_table" {
  type = string
}

variable "ecr_repository_arn" {
  type = string
}

variable "ecs_cluster_arn" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "ecs_service_arn" {
  type = string
}

variable "ecs_task_families" {
  description = "Task definition families the deploy role may run (the one-off migration task)"
  type        = list(string)
}

variable "ecs_execution_role_arn" {
  type = string
}

variable "ecs_task_role_arn" {
  type = string
}

variable "api_log_group_arn" {
  type = string
}

variable "web_bucket_arn" {
  type = string
}

variable "cloudfront_distribution_arn" {
  type = string
}
