# Agilytics OS — Security

> **Data security is the top priority.** Agilytics OS is an internal tool for
> companies. Their projects, people, and documents are their business. The
> v1 audit (Nov 2026) found RLS disabled on all 25 tables and cross-workspace
> IDORs — v2 is designed so that class of bug cannot happen silently.

## 1. Tenant isolation — two layers, not one

1. **Application layer:** every tenant-owned table has `tenantId`
   (`organisation` = tenant). Every service method scopes by `tenantId`
   (see `apps/api/src/modules/tickets/tickets.service.ts`). A query without
   a tenant scope is a bug, and code review must flag it.
2. **Database layer (Postgres RLS):** RLS is enabled on every tenant-owned
   table (`apps/api/prisma/migrations/20261117000000_init/migration.sql`).
   The API sets `app.tenant_id` per request from the Cognito JWT; policies
   only return rows for that tenant. Even if an API route forgets its
   `WHERE tenantId = …`, the database refuses to return cross-tenant rows.

Never disable RLS in production. Never add a `SET app.tenant_id` bypass.

## 2. Authentication — AWS Cognito

- One user pool, `custom:tenant_id` set at signup, never editable by the client.
- MFA enforced for platform admins; available (and recommended) for all users.
- JWTs are short-lived; refresh via Cognito. No passwords are ever stored
  in our database — Cognito owns credentials, password reset, and lockout.
- SAML / OIDC federation (enterprise SSO) is a later feature, not a hack:
  add an identity provider per tenant in Cognito, never a shared backdoor.
- Local dev only: `POST /api/v1/auth/dev-login` issues a test JWT. It must
  be removed / disabled in production (gate it on `NODE_ENV !== "production"`).

## 3. Authorisation — RBAC, per workspace

- Workspace roles: `OWNER, ADMIN, LEAD, MEMBER, VIEWER` (`packages/shared`).
- Platform roles: `PLATFORM_ADMIN, PLATFORM_SUPPORT` — a separate axis.
  A platform admin is **not** automatically a member of any tenant.
- `PLATFORM_SUPPORT` is read-only. It can never impersonate a tenant user.

## 4. No backdoors — support access, if ever built

There is deliberately **no impersonation** in v2. If support access is ever
added, it must be all of these, or it does not ship:

1. Explicit: the tenant admin grants it, in-product, for a named support
   person and a time window.
2. Logged: every support action goes to `AuditLog` with the support
   identity, the tenant, and the action.
3. Tenant-consented and revocable at any time by the tenant admin.
4. Read-only by default; write access requires a second, separate grant.

## 5. Encryption

- **In transit:** TLS everywhere (ALB terminates TLS, Vercel serves HTTPS,
  API only accepts HTTPS in production; HSTS).
- **At rest:** RDS storage encryption, S3 default encryption (SSE-S3 / SSE-KMS).
- **Integration OAuth tokens:** encrypted with AWS KMS before storage
  (`Integration.encryptedCredentials` — never plaintext, never in logs).

## 6. Secrets

- Secrets only via environment variables / AWS Secrets Manager. Never in
  code, never in git, never in a screenshot. `.env.example` lists names only.
- CI uses GitHub Actions OIDC — no long-lived AWS keys.
- Rotate the JWT secret and any leaked credential immediately; treat a
  leaked secret as an incident, not a cleanup task.

## 7. Audit log — every sensitive action

`AuditLog` records tenant, user, action, entity, and metadata for: auth
events, role changes, plan changes, integration connect/disconnect,
automation changes, exports, deletions, and any platform-admin action.
The Platform Admin Panel (`/admin`) has an audit-log viewer. Logs are
append-only; nobody, including platform admins, can edit or delete them
(enforce in the API — no DELETE endpoint for audit logs).

## 8. Network & platform hardening

- ALB + AWS WAF in front of the API; rate limiting on auth and webhook
  endpoints; request-size limits.
- API runs in private subnets; only the ALB is public. Database has no
  public access. Least-privilege IAM roles per service (API, worker).
- Security headers (CSP, X-Content-Type-Options, Referrer-Policy) on the web app.

## 9. Backups & recovery

- RDS automated backups + point-in-time recovery (PITR) on from day one.
- S3 versioning for documents. Tested restore at least quarterly — an
  untested backup is not a backup.

## 10. Security checklist (release gate)

- [ ] RLS enabled on every tenant table, verified by a cross-tenant test
- [ ] Cognito wired (no `dev-login` in production), MFA on for platform admins
- [ ] No secrets in git history (`git-secrets` / gitleaks in CI)
- [ ] Audit log covers all sensitive actions; append-only enforced
- [ ] Rate limiting + WAF enabled; API not publicly reachable except via ALB
- [ ] Backups + PITR verified with a real restore
- [ ] Dependency audit (`pnpm audit`) clean or triaged, in CI
- [ ] Incident runbook written (who, how, comms) before first paying tenant

## 11. Privacy boundary — what we as the platform can (and can never) see

This is a **product promise, not just a policy.** Full text:
[`docs/PRIVACY-BOUNDARY.md`](docs/PRIVACY-BOUNDARY.md).

- **We DO see/manage:** tenant metadata (company name, plan, billing
  status, user count, storage usage, feature flags), system health /
  uptime / error rates, the platform audit log **of our own admin
  actions**, support tickets the customer filed, and aggregated anonymous
  usage counts (never content).
- **We NEVER see (no application-level access):** ticket
  titles/descriptions, daily updates, comments, documents/files,
  messages, AI prompts/outputs, integration tokens (KMS-encrypted),
  passwords, or any customer business data. Honest form: **no
  application-level access, encrypted, audited, contractually barred**
  — engineers with production database credentials technically could
  read RDS; the promise is application-level, not physical impossibility.
- **Enforcement:** tenant scoping + RLS on every query (§1); no admin
  endpoint that lists customer content (the admin module returns
  metadata and our own audit trail only); no impersonation/backdoor (§4);
  support access only with explicit tenant consent, time-boxed, logged,
  and revocable; encryption at rest/in transit (§5); secrets in Secrets
  Manager (§6).
- **Platform admins are not members of any tenant.** `PLATFORM_ADMIN`
  grants access to tenant metadata and platform operations — never to a
  tenant's data. `PLATFORM_SUPPORT` is read-only and can never
  impersonate a tenant user.
- **If the boundary is ever breached,** treat it as a security incident:
  contain, notify affected tenants, rotate credentials, fix the code
  path, and record it in the incident log.
