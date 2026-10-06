# Only non-secret values are exported. The database password lives exclusively in Secrets Manager
# (written through write-only arguments, so it is not in the state file either).

output "api_url" {
  description = "API through the ALB (HTTP): GET <api_url>/health"
  value       = "http://${module.api.alb_dns_name}"
}

output "alb_dns_name" {
  value = module.api.alb_dns_name
}

output "web_url" {
  description = "The React app through CloudFront; /api/* is proxied to the ALB"
  value       = "https://${module.web.cloudfront_domain_name}"
}

output "cloudfront_distribution_id" {
  value = module.web.cloudfront_distribution_id
}

output "web_bucket" {
  description = "S3 bucket that holds the React build (make deploy-web)"
  value       = module.web.bucket_name
}

output "files_bucket" {
  description = "S3 bucket for uploaded files (replaces ContentVersion)"
  value       = module.files.bucket_name
}

output "ecr_repository_url" {
  value = module.api.ecr_repository_url
}

output "ecs_cluster_name" {
  value = module.api.ecs_cluster_name
}

output "ecs_service_name" {
  value = module.api.ecs_service_name
}

output "ecs_task_family" {
  value = module.api.task_family
}

output "api_log_group" {
  value = module.api.log_group_name
}

output "db_endpoint" {
  description = "RDS endpoint (host:port); credentials are in the app secret"
  value       = module.database.endpoint
}

output "db_instance_identifier" {
  value = module.database.instance_identifier
}

output "app_secret_arn" {
  description = "Secrets Manager secret the API reads (AWS_SECRETS_MANAGER_SECRET_ID); JSON with DATABASE_URL"
  value       = module.database.app_secret_arn
}

output "cognito_user_pool_id" {
  value = module.auth.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Public SPA client (no secret) - VITE_COGNITO_CLIENT_ID"
  value       = module.auth.user_pool_client_id
}

output "cognito_groups" {
  value = module.auth.group_names
}

output "vpc_id" {
  value = module.network.vpc_id
}
