# ==============================================================================
# AWS Secrets Manager Configuration
# Stores and encrypts application secrets at rest using AWS KMS
# Injected into ECS container memory at runtime by the ECS Agent
# ==============================================================================

# Random 64-character encryption secret for iron-session
resource "random_password" "session_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.app_name}/${var.environment}/app-secrets"
  description             = "Production runtime credentials for AR/VR Academy platform"
  recovery_window_in_days = 0

  tags = {
    Name        = "${var.app_name}-secrets-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    DATABASE_URL         = "postgresql://${var.db_username}:${random_password.db_master_password.result}@${aws_db_instance.postgres.endpoint}/${var.db_name}?sslmode=require"
    SESSION_SECRET       = random_password.session_secret.result
    REDIS_URL            = "rediss://:${random_password.redis_auth_token.result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
    AWS_REGION           = var.aws_region
    AWS_S3_BUCKET_NAME   = aws_s3_bucket.submissions.id
    GOOGLE_CLIENT_ID     = ""
    GOOGLE_CLIENT_SECRET = ""
    GOOGLE_REDIRECT_URI  = "https://${var.domain_name}/api/google-drive/oauth/callback"
  })
}
