# ==============================================================================
# Amazon RDS PostgreSQL Multi-AZ Enterprise Database
# Isolated Subnets | KMS Encrypted | Automated Daily Backups | Storage Auto-Scale
# ==============================================================================

# Subnet Group for RDS (spans across 2 isolated private data subnets)
resource "aws_db_subnet_group" "rds" {
  name        = "${var.app_name}-rds-subnet-group-${var.environment}"
  description = "Isolated subnets for AR/VR Academy RDS PostgreSQL cluster"
  subnet_ids  = aws_subnet.isolated_data[*].id

  tags = {
    Name        = "${var.app_name}-rds-subnet-group-${var.environment}"
    Environment = var.environment
  }
}

# Custom Parameter Group to enforce TLS in transit
resource "aws_db_parameter_group" "postgres16" {
  name   = "${var.app_name}-pg16-params-${var.environment}"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name        = "${var.app_name}-pg16-params-${var.environment}"
    Environment = var.environment
  }
}

# Generate cryptographically secure random password for database master user
resource "random_password" "db_master_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Primary Multi-AZ PostgreSQL Instance
resource "aws_db_instance" "postgres" {
  identifier            = "${var.app_name}-db-${var.environment}"
  engine                = "postgres"
  engine_version        = "16"
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_master_password.result
  port     = 5432

  # High Availability: Synchronous physical standby replica in second AZ
  multi_az               = true
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  # Backup & Maintenance Strategy
  backup_retention_period    = 14                    # 14-day Point-In-Time-Recovery (PITR) window
  backup_window              = "03:00-04:00"         # UTC
  maintenance_window         = "Sun:04:30-Sun:05:30" # UTC
  copy_tags_to_snapshot      = true
  skip_final_snapshot        = false
  final_snapshot_identifier  = "${var.app_name}-db-final-snapshot-${var.environment}"
  deletion_protection        = true
  auto_minor_version_upgrade = true

  tags = {
    Name        = "${var.app_name}-db-${var.environment}"
    Environment = var.environment
  }
}
