variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  description = "Private subnets for the DB subnet group"
  type        = list(string)
}

variable "client_security_group_id" {
  description = "Security group allowed to connect on 5432 (the ECS tasks)"
  type        = string
}

variable "instance_class" {
  type = string
}

variable "engine_version" {
  type = string
}

variable "password_version" {
  description = "Bump to rotate the master password"
  type        = number
}

variable "secret_name" {
  description = "Name of the Secrets Manager secret the API reads (JSON with DATABASE_URL)"
  type        = string
}

variable "db_name" {
  type    = string
  default = "dreamhouse"
}

variable "db_username" {
  type    = string
  default = "dreamhouse"
}

variable "log_retention_days" {
  type = number
}
