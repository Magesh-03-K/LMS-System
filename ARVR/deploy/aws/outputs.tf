output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "ECR Repository URL for pushing Docker images"
  value       = aws_ecr_repository.app.repository_url
}

output "rds_endpoint" {
  description = "RDS PostgreSQL cluster connection endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "s3_submissions_bucket" {
  description = "Name of the private S3 bucket for task submissions"
  value       = aws_s3_bucket.submissions.id
}

output "secrets_manager_arn" {
  description = "ARN of the AWS Secrets Manager application secret"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS Cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_service_name" {
  description = "Name of the ECS Fargate Service"
  value       = aws_ecs_service.app.name
}
