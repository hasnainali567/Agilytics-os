import { z } from "zod";

/**
 * Platform roles — separate from workspace roles. PLATFORM_ADMIN controls the
 * whole platform (see apps/web /admin and apps/api admin module).
 * PLATFORM_SUPPORT is read-only and can never impersonate a tenant user:
 * support access, if ever built, must be explicit, logged, and
 * tenant-consented. See SECURITY.md.
 */
export const platformRoleSchema = z.enum(["PLATFORM_ADMIN", "PLATFORM_SUPPORT"]);
export type PlatformRole = z.infer<typeof platformRoleSchema>;

export const planSchema = z.enum(["FREE", "TEAM", "BUSINESS", "ENTERPRISE"]);
export type Plan = z.infer<typeof planSchema>;

export const featureFlagSchema = z.object({
  key: z.string().min(1).max(120),
  enabled: z.boolean(),
  tenantId: z.string().uuid().nullable(),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().uuid().nullable(),
  createdAt: z.date(),
});
export type AuditLogEntry = z.infer<typeof auditLogSchema>;
