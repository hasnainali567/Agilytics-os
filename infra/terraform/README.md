# Infrastructure — Agilytics OS v2 (AWS)

Terraform skeleton. **Not yet applied.** Nothing in `infra/` has touched AWS.

## Apply (dev first)

```bash
cd infra/terraform
terraform init
terraform plan -var environment=dev
terraform apply -var environment=dev
```

Before the first real apply, add an S3 + DynamoDB remote backend in
`versions.tf` (currently local state — fine for a skeleton, not for a team).

## What it provisions

- VPC (public + private subnets, 2 AZs), ALB (WAF + ACM TODO)
- ECS Fargate cluster + API service (small tasks by default, see `variables.tf`)
- RDS Postgres 16, storage-encrypted, backups + PITR on, single-AZ in dev,
  Multi-AZ in prod (`db_multi_az = true`)
- S3 files bucket (encrypted, versioned), SQS jobs queue + DLQ
- Cognito user pool — see `cognito.tf` (currently commented skeleton)

## Cost-lean defaults

No EKS, no ElastiCache, no NAT Gateway-heavy design yet. The Fargate API
runs at 0.25 vCPU / 512 MiB, one task, and RDS starts at `db.t4g.small`.
Scale by changing variables, not by rewriting the stack. Add ElastiCache /
read replicas only when load demands them.
