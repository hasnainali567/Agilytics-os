# --- RDS Postgres ---
resource "aws_db_subnet_group" "main" {
  name       = "agilytics-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier             = "agilytics-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  storage_encrypted      = true # encryption at rest — non-negotiable (SECURITY.md)
  multi_az               = var.db_multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  backup_retention_period = 7 # PITR — raise to 30 in prod
  deletion_protection    = true
  skip_final_snapshot    = false
  # username/password come from Secrets Manager via the API, not TF variables.
}

# --- S3 (files / docs) ---
resource "aws_s3_bucket" "files" {
  bucket = "agilytics-${var.environment}-files"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id
  versioning_configuration {
    status = "Enabled"
  }
}

# --- SQS (async jobs: AI, integrations, notifications) ---
resource "aws_sqs_queue" "jobs" {
  name                       = "agilytics-${var.environment}-jobs"
  visibility_timeout_seconds = 300
}

resource "aws_sqs_queue" "jobs_dlq" {
  name = "agilytics-${var.environment}-jobs-dlq"
}
