output "alb_dns_name" {
  description = "Public DNS name of the API load balancer."
  value       = aws_lb.api.dns_name
}

output "rds_endpoint" {
  description = "RDS endpoint (private — no public access)."
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "s3_files_bucket" {
  value = aws_s3_bucket.files.id
}

output "sqs_jobs_queue_url" {
  value = aws_sqs_queue.jobs.url
}
