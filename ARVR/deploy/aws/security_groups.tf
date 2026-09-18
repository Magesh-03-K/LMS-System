# ==============================================================================
# Security Groups (Zero-Trust Inter-Tier Referencing)
# Internet -> ALB SG (443/80) -> ECS Tasks SG (3000) -> RDS (5432) & Redis (6379)
# Decoupled via standalone aws_security_group_rule resources to prevent DAG cycles
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Application Load Balancer Security Group
# ------------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.app_name}-alb-sg-${var.environment}"
  description = "Controls public HTTPS ingress to the Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${var.app_name}-alb-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group_rule" "alb_ingress_http" {
  type              = "ingress"
  security_group_id = aws_security_group.alb.id
  description       = "Allow inbound HTTP for redirection to HTTPS"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "alb_ingress_https" {
  type              = "ingress"
  security_group_id = aws_security_group.alb.id
  description       = "Allow inbound HTTPS from the internet"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "alb_egress_ecs" {
  type                     = "egress"
  security_group_id        = aws_security_group.alb.id
  description              = "Allow outbound to ECS tasks on port 3000"
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
}

# ------------------------------------------------------------------------------
# 2. ECS Fargate Tasks Security Group
# ------------------------------------------------------------------------------
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.app_name}-ecs-tasks-sg-${var.environment}"
  description = "Controls ingress to Next.js containers and egress to DB, Redis, and APIs"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${var.app_name}-ecs-tasks-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group_rule" "ecs_ingress_alb" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs_tasks.id
  description              = "Allow inbound HTTP from ALB only"
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "ecs_egress_rds" {
  type                     = "egress"
  security_group_id        = aws_security_group.ecs_tasks.id
  description              = "Allow outbound to PostgreSQL RDS"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
}

resource "aws_security_group_rule" "ecs_egress_redis" {
  type                     = "egress"
  security_group_id        = aws_security_group.ecs_tasks.id
  description              = "Allow outbound to ElastiCache Redis"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.redis.id
}

resource "aws_security_group_rule" "ecs_egress_https" {
  type              = "egress"
  security_group_id = aws_security_group.ecs_tasks.id
  description       = "Allow outbound HTTPS for AWS APIs (S3, Secrets Manager, ECR, CloudWatch) and OAuth"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

# ------------------------------------------------------------------------------
# 3. Amazon RDS PostgreSQL Security Group
# ------------------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "${var.app_name}-rds-sg-${var.environment}"
  description = "Controls access to PostgreSQL database. Inbound allowed exclusively from ECS tasks."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${var.app_name}-rds-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group_rule" "rds_ingress_ecs" {
  type                     = "ingress"
  security_group_id        = aws_security_group.rds.id
  description              = "Allow PostgreSQL access from ECS tasks only"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
}

# ------------------------------------------------------------------------------
# 4. Amazon ElastiCache Redis Security Group
# ------------------------------------------------------------------------------
resource "aws_security_group" "redis" {
  name        = "${var.app_name}-redis-sg-${var.environment}"
  description = "Controls access to Redis cache cluster. Inbound allowed exclusively from ECS tasks."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${var.app_name}-redis-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group_rule" "redis_ingress_ecs" {
  type                     = "ingress"
  security_group_id        = aws_security_group.redis.id
  description              = "Allow Redis access from ECS tasks only"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
}
