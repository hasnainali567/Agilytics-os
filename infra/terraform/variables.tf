variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "dev | staging | prod"
  type        = string
  default     = "dev"
}

variable "db_instance_class" {
  description = "RDS instance class. Start small; scale up, don't over-provision."
  type        = string
  default     = "db.t4g.small"
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS. Keep false in dev, true in prod."
  type        = bool
  default     = false
}

variable "api_cpu" {
  description = "Fargate CPU units for the API task (256 = 0.25 vCPU)."
  type        = number
  default     = 256
}

variable "api_memory" {
  description = "Fargate memory (MiB) for the API task."
  type        = number
  default     = 512
}

variable "api_desired_count" {
  description = "Number of API tasks to run."
  type        = number
  default     = 1
}

variable "domain_name" {
  description = "API domain (e.g. api.agilytics.app). Empty = ALB DNS only."
  type        = string
  default     = ""
}
