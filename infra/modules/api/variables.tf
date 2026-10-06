variable "name" {
  type = string
}

variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  description = "Subnets of the internet-facing ALB"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Subnets of the Fargate tasks"
  type        = list(string)
}

variable "image_tag" {
  type = string
}

variable "desired_count" {
  type = number
}

variable "cpu" {
  type = number
}

variable "memory" {
  type = number
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "log_retention_days" {
  type = number
}

variable "app_secret_arn" {
  description = "Secrets Manager secret with the runtime configuration (DATABASE_URL)"
  type        = string
}

variable "files_bucket_arn" {
  type = string
}

variable "files_bucket_name" {
  type = string
}

variable "user_pool_id" {
  type = string
}

variable "user_pool_arn" {
  type = string
}

variable "user_pool_client_id" {
  type = string
}
