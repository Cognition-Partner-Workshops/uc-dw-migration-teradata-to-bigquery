output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "alb_arn" {
  value = aws_lb.api.arn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_repository_name" {
  value = aws_ecr_repository.api.name
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  value = aws_ecs_service.api.name
}

output "task_family" {
  value = aws_ecs_task_definition.api.family
}

output "task_security_group_id" {
  value = aws_security_group.task.id
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "ecr_repository_arn" {
  value = aws_ecr_repository.api.arn
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "ecs_service_arn" {
  value = aws_ecs_service.api.id
}

output "migrate_task_family" {
  value = aws_ecs_task_definition.migrate.family
}

output "execution_role_arn" {
  value = aws_iam_role.execution.arn
}

output "log_group_arn" {
  value = aws_cloudwatch_log_group.api.arn
}
