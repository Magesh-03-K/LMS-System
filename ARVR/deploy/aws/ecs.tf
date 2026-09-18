# ==============================================================================
# AWS ECS Fargate Service & ECR Container Registry
# Serverless Compute | CloudWatch Logging | Rolling Zero-Downtime Deployments
# Automated Circuit Breaker Rollback | Container Insights
# ==============================================================================

# 1. Amazon ECR Private Container Registry
resource "aws_ecr_repository" "app" {
  name                 = var.app_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.app_name}-ecr"
    Environment = var.environment
  }
}

# Lifecycle Policy: Keep last 10 images to conserve storage costs
resource "aws_ecr_lifecycle_policy" "cleanup" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# 2. Amazon CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.app_name}-${var.environment}"
  retention_in_days = 30

  tags = {
    Name        = "${var.app_name}-logs-${var.environment}"
    Environment = var.environment
  }
}

# 3. Amazon ECS Cluster with Container Insights
resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${var.app_name}-ecs-cluster-${var.environment}"
    Environment = var.environment
  }
}

# 4. ECS Fargate Task Definition
resource "aws_ecs_task_definition" "app" {
  family                   = "${var.app_name}-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.app_cpu)
  memory                   = tostring(var.app_memory)
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "arvr-academy-app"
      image     = "${aws_ecr_repository.app.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = var.app_port
          hostPort      = var.app_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.app_port) },
        { name = "HOSTNAME", value = "0.0.0.0" },
        { name = "SKIP_MIGRATIONS", value = "false" },
        { name = "DB_WAIT_RETRIES", value = "30" }
      ]

      # Secrets dynamically retrieved from AWS Secrets Manager by ECS Agent at container boot
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::"
        },
        {
          name      = "SESSION_SECRET"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SESSION_SECRET::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:REDIS_URL::"
        },
        {
          name      = "AWS_REGION"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:AWS_REGION::"
        },
        {
          name      = "AWS_S3_BUCKET_NAME"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:AWS_S3_BUCKET_NAME::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }
    }
  ])

  tags = {
    Name        = "${var.app_name}-task-def-${var.environment}"
    Environment = var.environment
  }
}

# 5. ECS Fargate Service with Automated Circuit-Breaker Rollback
resource "aws_ecs_service" "app" {
  name            = "${var.app_name}-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Rolling Deployment Configuration: Guarantees 100% minimum capacity during updates
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Automatic Rollback on Failed Deployments
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private_app[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "arvr-academy-app"
    container_port   = var.app_port
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_execution_standard
  ]

  tags = {
    Name        = "${var.app_name}-ecs-service-${var.environment}"
    Environment = var.environment
  }
}
