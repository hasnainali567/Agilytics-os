# API — Agilytics OS v2

NestJS + Prisma + PostgreSQL. Runs on AWS ECS Fargate (see `infra/terraform/`).

## Auth — Cognito wiring (TODO, documented here, not hardcoded)

The JWT guard (`src/common/guards/jwt-auth.guard.ts`) currently validates a
symmetric `JWT_SECRET` for local dev only. For production:

1. Create the Cognito user pool with Terraform (`infra/terraform/cognito.tf`
   — skeleton). One pool, custom attribute `custom:tenant_id` set at signup
   and never editable from the client.
2. Set `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION` in the
   environment (Secrets Manager in AWS, `.env` locally).
3. Swap the guard's secret verification for JWKS verification against
   `https://cognito-idp.<region>.amazonaws.com/<poolId>/.well-known/jwks.json`,
   and read `tenant_id` from the JWT claims into the request context
   (`src/common/decorators/tenant.decorator.ts`).
4. Every service method already scopes by `tenantId` — see
   `src/modules/tickets/tickets.service.ts`. Postgres RLS is the second layer
   (`prisma/migrations/.../migration.sql`).

No secrets are committed anywhere in this repo.

## Run

```bash
pnpm prisma:generate
pnpm prisma:migrate   # needs local Postgres — docker compose up -d
pnpm prisma:seed
pnpm start:dev        # :3001, OpenAPI at /api/docs
```
