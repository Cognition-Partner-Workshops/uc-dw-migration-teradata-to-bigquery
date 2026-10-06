variable "name" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "availability_zones" {
  description = "AZs; one public and one private subnet is created in each"
  type        = list(string)
}
