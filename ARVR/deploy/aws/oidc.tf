# ==============================================================================
# AWS IAM OpenID Connect (OIDC) for GitHub Actions
# Zero Static Credentials | Secure JWT Token Exchange | Scoped Repository Trust
# ==============================================================================

variable "github_repo" {
  description = "GitHub repository in format 'owner/repo-name' allowed to assume this role"
  type        = string
  default     = "Livesh28/ARVR"
}

# 1. GitHub OIDC Identity Provider in AWS IAM
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f8d264fcd9"
  ]

  tags = {
    Name        = "github-actions-oidc-provider"
    Environment = var.environment
  }
}

# 2. IAM Role Assumed by GitHub Actions via OIDC
resource "aws_iam_role" "github_actions" {
  name = "${var.app_name}-github-actions-deploy-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-github-actions-deploy-role"
    Environment = var.environment
  }
}

# 3. Least-Privilege CI/CD Deployment Policy
resource "aws_iam_policy" "github_actions_deploy" {
  name        = "${var.app_name}-github-deploy-policy-${var.environment}"
  description = "Grants GitHub Actions permissions to push to ECR, run DB migrations, and update ECS service"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR Authentication & Image Push
      {
        Sid      = "ECRAuth"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "ECRImageOperations"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = aws_ecr_repository.app.arn
      },

      # ECS Task Registration & Service Deployment
      {
        Sid    = "ECSTaskRegistration"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECSServiceUpdate"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ]
        Resource = aws_ecs_service.app.id
      },

      # ECS RunTask for Pre-Deployment Database Migrations
      {
        Sid    = "ECSRunMigrationTask"
        Effect = "Allow"
        Action = [
          "ecs:RunTask",
          "ecs:DescribeTasks"
        ]
        Resource = [
          "arn:aws:ecs:${var.aws_region}:*:task/${aws_ecs_cluster.main.name}/*",
          "arn:aws:ecs:${var.aws_region}:*:task-definition/${var.app_name}-${var.environment}:*"
        ]
      },

      # IAM PassRole (Required so ECS can execute tasks with task roles)
      {
        Sid    = "IAMPassRole"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.ecs_execution.arn,
          aws_iam_role.ecs_task.arn
        ]
      },

      # CloudWatch Logs for Deployment Health Checks
      {
        Sid    = "CloudWatchLogInspection"
        Effect = "Allow"
        Action = [
          "logs:GetLogEvents",
          "logs:FilterLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.ecs.arn}:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_deploy" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions_deploy.arn
}

output "github_actions_role_arn" {
  description = "ARN of the IAM Role for GitHub Actions (add as AWS_ROLE_TO_ASSUME secret in GitHub)"
  value       = aws_iam_role.github_actions.arn
}
