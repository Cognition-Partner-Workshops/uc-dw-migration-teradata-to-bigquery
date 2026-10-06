output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

output "user_pool_endpoint" {
  value = aws_cognito_user_pool.this.endpoint
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "group_names" {
  value = sort(keys(aws_cognito_user_group.this))
}
