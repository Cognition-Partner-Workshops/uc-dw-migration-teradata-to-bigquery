output "endpoint" {
  value = aws_db_instance.this.endpoint
}

output "address" {
  value = aws_db_instance.this.address
}

output "instance_identifier" {
  value = aws_db_instance.this.identifier
}

output "security_group_id" {
  value = aws_security_group.db.id
}

output "app_secret_arn" {
  description = "Consumers (the ECS task) must not start before the secret has a value"
  value       = aws_secretsmanager_secret.app.arn
  depends_on  = [aws_secretsmanager_secret_version.app]
}

output "app_secret_name" {
  value = aws_secretsmanager_secret.app.name
}
