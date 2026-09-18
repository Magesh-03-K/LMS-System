# ==============================================================================
# Terraform & AWS Provider Configuration
# Pinned Versions | Multi-AZ Region Binding | Default Resource Tagging
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = var.app_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
