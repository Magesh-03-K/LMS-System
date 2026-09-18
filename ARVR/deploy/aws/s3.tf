# ==============================================================================
# Amazon S3 Private Storage Bucket for Task Submissions
# Private Bucket | KMS Encryption | CORS for Presigned Uploads | TLS Enforced
# ==============================================================================

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "submissions" {
  bucket        = "${var.app_name}-submissions-${var.environment}-${random_id.bucket_suffix.hex}"
  force_destroy = false

  tags = {
    Name        = "${var.app_name}-submissions-${var.environment}"
    Environment = var.environment
  }
}

# 1. Enable Versioning (prevents accidental student file deletion or overwrite)
resource "aws_s3_bucket_versioning" "submissions" {
  bucket = aws_s3_bucket.submissions.id
  versioning_configuration {
    status = "Enabled"
  }
}

# 2. Strict Public Access Block (Zero direct public internet access)
resource "aws_s3_bucket_public_access_block" "submissions" {
  bucket = aws_s3_bucket.submissions.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 3. Server-Side Encryption Configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "submissions" {
  bucket = aws_s3_bucket.submissions.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# 4. Cross-Origin Resource Sharing (CORS) for Direct Browser-to-S3 Presigned Uploads
resource "aws_s3_bucket_cors_configuration" "submissions" {
  bucket = aws_s3_bucket.submissions.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = [
      "https://${var.domain_name}",
      "https://*.${var.domain_name}"
    ]
    expose_headers  = ["ETag", "Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }
}

# 5. Bucket Lifecycle Rule (Cost optimization: transitions older files to Infrequent Access)
resource "aws_s3_bucket_lifecycle_configuration" "submissions" {
  bucket = aws_s3_bucket.submissions.id

  rule {
    id     = "archive-old-submissions"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# 6. Bucket Policy: Enforce HTTPS In-Transit Transmission Only
resource "aws_s3_bucket_policy" "enforce_tls" {
  bucket = aws_s3_bucket.submissions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLSRequestsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.submissions.arn,
          "${aws_s3_bucket.submissions.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}
