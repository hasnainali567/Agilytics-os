terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # TODO: add an S3 + DynamoDB remote backend before first apply.
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "agilytics-os"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Cost-lean defaults (see variables.tf): small Fargate tasks, single-AZ RDS to
# start, no EKS, no ElastiCache. Scale up by changing variables, not by
# rewriting the stack.
