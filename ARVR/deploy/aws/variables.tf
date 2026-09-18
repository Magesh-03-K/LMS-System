variable "aws_region" {
  description = "Target AWS Region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment identifier (e.g. production, staging)"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Application name for resource naming and tagging"
  type        = string
  default     = "arvr-academy"
}

variable "vpc_cidr" {
  description = "CIDR block for the primary VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability Zones to span for high availability"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "app_port" {
  description = "Port exposed by the Next.js container"
  type        = number
  default     = 3000
}

variable "app_cpu" {
  description = "Fargate Task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "app_memory" {
  description = "Fargate Task Memory in MB (2048 = 2 GB)"
  type        = number
  default     = 2048
}

variable "desired_count" {
  description = "Desired number of ECS task replicas"
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB for RDS"
  type        = number
  default     = 50
}

variable "db_max_allocated_storage" {
  description = "Maximum storage auto-scaling limit in GB for RDS"
  type        = number
  default     = 200
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "arvr"
}

variable "db_username" {
  description = "Master database administrator username"
  type        = string
  default     = "arvr_admin"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t4g.small"
}

variable "certificate_arn" {
  description = "ARN of the ACM SSL Certificate for HTTPS termination (leave blank if provisioning new)"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Custom domain name (e.g. academy.yourdomain.com)"
  type        = string
  default     = "academy.yourdomain.com"
}
