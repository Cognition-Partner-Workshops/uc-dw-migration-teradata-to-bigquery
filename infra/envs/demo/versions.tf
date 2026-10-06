terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "aws" {
  region = var.aws_region

  # Every resource of the demo carries these tags (resources that cannot be tagged are the exception).
  default_tags {
    tags = {
      project     = var.project
      environment = var.environment
      managed_by  = "terraform"
      repo        = "Cognition-Partner-Workshops/uc-dw-migration-teradata-to-bigquery"
      branch      = "salesforce-to-aws-demo"
    }
  }
}
