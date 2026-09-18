# ==============================================================================
# Amazon ElastiCache for Redis 7 (In-Memory Distributed Rate Limiting & Auth)
# Multi-AZ Replication | Transit & At-Rest Encryption | Isolated Subnets
# ==============================================================================

# Subnet Group for Redis
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.app_name}-redis-subnet-group-${var.environment}"
  description = "Isolated subnets for AR/VR Academy ElastiCache Redis cluster"
  subnet_ids  = aws_subnet.isolated_data[*].id

  tags = {
    Name        = "${var.app_name}-redis-subnet-group-${var.environment}"
    Environment = var.environment
  }
}

# Parameter Group for Redis 7
resource "aws_elasticache_parameter_group" "redis7" {
  name   = "${var.app_name}-redis7-params-${var.environment}"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  tags = {
    Name        = "${var.app_name}-redis7-params-${var.environment}"
    Environment = var.environment
  }
}

# Generate cryptographically secure auth token for Redis
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false # Redis auth token must be alphanumeric without special chars
}

# Redis Replication Group (Multi-AZ with automatic failover)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.app_name}-redis-${var.environment}"
  description          = "Distributed rate limiting and session revocation cluster"
  node_type            = var.redis_node_type
  num_cache_clusters   = 2
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis7.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  # High Availability & Failover
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # Security: In-Transit and At-Rest Encryption with Auth Token
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  # Maintenance & Backup
  snapshot_retention_limit   = 5
  snapshot_window            = "02:00-03:00"
  maintenance_window         = "sun:03:30-sun:04:30"
  auto_minor_version_upgrade = true

  tags = {
    Name        = "${var.app_name}-redis-${var.environment}"
    Environment = var.environment
  }
}
