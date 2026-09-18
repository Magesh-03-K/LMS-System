# ==============================================================================
# IAM Roles & Least-Privilege Policies
# 1. ECS Task Execution Role (Used by AWS ECS Agent to pull image and inject secrets)
# 2. ECS Task Role (Used by the application running inside the container)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. ECS Task Execution Role
# ------------------------------------------------------------------------------
resource "aws_iam_role" "ecs_execution" {
  name = "${var.app_name}-ecs-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-ecs-execution-role-${var.environment}"
    Environment = var.environment
  }
}

# Attach AWS managed policy for standard ECS execution (ECR + CloudWatch)
resource "aws_iam_role_policy_attachment" "ecs_execution_standard" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Inline policy to read secrets from AWS Secrets Manager
resource "aws_iam_policy" "ecs_execution_secrets" {
  name        = "${var.app_name}-execution-secrets-policy-${var.environment}"
  description = "Allows ECS agent to retrieve application secrets at container boot"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.app_secrets.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_secrets" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = aws_iam_policy.ecs_execution_secrets.arn
}

# ------------------------------------------------------------------------------
# 2. ECS Task Role (Application Permissions)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task" {
  name = "${var.app_name}-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-ecs-task-role-${var.environment}"
    Environment = var.environment
  }
}

# Scoped S3 Policy: Only allowed to read/write/delete objects in the submissions bucket
resource "aws_iam_policy" "ecs_task_s3" {
  name        = "${var.app_name}-task-s3-policy-${var.environment}"
  description = "Grants least-privilege S3 object access for student task submissions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowS3ObjectOperations"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:HeadObject"
        ]
        Resource = [
          "${aws_s3_bucket.submissions.arn}/*"
        ]
      },
      {
        Sid    = "AllowS3BucketList"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.submissions.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_s3" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_task_s3.arn
}
