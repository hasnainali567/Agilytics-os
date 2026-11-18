# Privacy boundary — what we as the platform can (and can never) see

> **Product promise, not just a policy.** Agilytics OS is an internal tool
> for companies. Their projects, people, documents, and daily updates are
> their business. We built the platform so that we have **no
> application-level access** to a customer's confidential data — no code
> path in the application lets us browse it. Stated honestly: engineers
> with production database credentials technically could read RDS — the
> promise is **no application-level access, encrypted, audited,
> contractually barred**, not physical impossibility.

## 1. What we DO see and manage

As SaaS / platform admins (`PLATFORM_ADMIN`, `PLATFORM_SUPPORT`), we can
see and manage **tenant metadata and platform operations only**:

| We see / manage                                                                                                  | Why                                   | Where it lives                                   |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| Tenant metadata — company name, slug, plan, billing status, user count, storage usage, feature flags             | Run the platform, bill, support plans | `organisations`, platform admin panel (`/admin`) |
| System health — uptime, error rates, latency, queue depth, per-service status                                    | Keep the platform up                  | Admin health view, CloudWatch                    |
| Platform audit log **of our own admin actions** — who on our team did what, to which tenant's metadata, and when | Accountability for us                 | `AuditLog` (admin actions only)                  |
| Support tickets the customer filed                                                                               | Answer them                           | Support channel (not in the product DB)          |
| Aggregated anonymous usage counts — e.g. "1,240 daily updates posted platform-wide yesterday", never who or what | Capacity planning, product decisions  | Aggregated counters only, no content             |

## 2. What we NEVER see — no application-level access

We have no application-level access to **any customer business data**:
we cannot see, read, export, or process it through the application:

- Ticket titles, descriptions, estimates, assignees
- Daily updates (what was done, blockers, health, time spent)
- Comments and messages
- Documents and files (Project Docs)
- AI prompts and AI outputs
- Integration tokens (KMS-encrypted; we hold the key management, never
  the plaintext)
- Passwords (Cognito owns credentials; we store none)
- Any other content a customer or their team puts into the product

**There is no "view customer data" feature.** If a support case ever
needs us to look at a customer's workspace, that is only possible
through the consented support-access flow in §4 — and even that is
read-only by default.

## 3. How the boundary is enforced (technically, not just by rule)

1. **Tenant scoping on every query.** Every service method scopes by
   `tenantId` from the Cognito JWT. A query without a tenant scope is a
   bug, and code review must flag it.
2. **Postgres RLS as the second layer.** RLS is enabled on every
   tenant-owned table. The API sets `app.tenant_id` per request; the
   database refuses cross-tenant rows even if an API route forgets its
   `WHERE` clause.
3. **Platform admins are not members of any tenant.** `PLATFORM_ADMIN`
   is a separate role axis. It grants access to tenant **metadata** and
   platform operations — it does not grant membership of a tenant, and
   membership is what the data queries check.
4. **No admin endpoint lists customer content.** The admin module
   (`GET /admin/organisations`, `/admin/users`, `/admin/audit-logs`,
   `/admin/health`) returns metadata and our own audit trail only.
   There is no endpoint that returns tickets, updates, comments,
   documents, or AI history for a tenant. Adding one requires a design
   review and a privacy review — it is not a one-line change.
5. **No impersonation, no backdoor.** There is deliberately no
   "log in as tenant user" capability in v2. `PLATFORM_SUPPORT` is
   read-only and can never impersonate a tenant user.
6. **Encryption.** TLS in transit; RDS/S3 encryption at rest; integration
   OAuth tokens encrypted with KMS before storage (never plaintext,
   never in logs). Secrets only via env / Secrets Manager.
7. **Audit log is append-only.** Nobody, including platform admins, can
   edit or delete audit-log rows (enforced in the API — no DELETE
   endpoint for audit logs).

## 4. Support access — only with explicit tenant consent

Support access does **not exist** in v2. If it is ever built, it must be
all of the following, or it does not ship:

1. **Explicit:** the tenant admin grants it in-product, for a named
   support person and a time window.
2. **Time-boxed:** the grant expires automatically; there is no permanent
   support access.
3. **Logged:** every support action goes to `AuditLog` with the support
   identity, the tenant, and the action. The tenant admin can see that
   log.
4. **Tenant-consented and revocable** at any time by the tenant admin.
5. **Read-only by default;** write access requires a second, separate
   grant.

Until that feature ships, the answer to "can you look at our workspace?"
is: **no — and that is by design.**

## 5. What customers can verify

- **Ask us to prove it:** the admin API surface is in
  `SYSTEM-DESIGN.md` §5 — a customer (or their security reviewer) can
  read it and confirm there is no content-listing endpoint.
- **Audit log of our actions:** tenant admins can request the record of
  every platform-admin action touching their tenant's metadata.
- **Data export / deletion:** a tenant can export its data and request
  deletion on churn (see OPEN QUESTION 11 in `DESIGN-DECISIONS.md` —
  exact format and SLA are still to be decided with Jhon).

## 6. If the boundary is ever breached

Treat it as a **security incident**, not a cleanup task: contain,
notify affected tenants, rotate credentials, fix the code path, and
record it in the incident log. The runbook is written before the first
paying tenant (see `SECURITY.md` §10).
