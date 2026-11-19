import { verify } from "jsonwebtoken";

export interface SocketIdentity {
  userId: string;
  tenantId: string;
  platformRole?: string;
}

/**
 * Socket handshake auth — mirrors JwtAuthGuard exactly (same symmetric
 * verify with JWT_SECRET, same claim precedence), so a token that works
 * for REST works for the socket and vice versa.
 *
 * Production swap (Cognito): replace the verify() call here AND in
 * JwtAuthGuard with JWKS verification against
 * https://cognito-idp.<region>.amazonaws.com/<poolId>/.well-known/jwks.json
 * and read `custom:tenant_id` — the claim names below already handle both
 * shapes. See apps/api/README.md for the wiring checklist.
 */
export function verifySocketToken(token: string | undefined | null, secret: string): SocketIdentity {
  if (!token) {
    throw new Error("Missing token");
  }
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  try {
    const payload = verify(token, secret) as {
      sub?: string;
      tenantId?: string;
      platformRole?: string;
      "custom:tenant_id"?: string;
      "custom:platform_role"?: string;
    };
    if (!payload.sub) {
      throw new Error("Invalid token");
    }
    return {
      userId: payload.sub,
      tenantId: payload["custom:tenant_id"] ?? payload.tenantId ?? "demo-tenant",
      platformRole: payload.platformRole ?? payload["custom:platform_role"],
    };
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid token") throw err;
    throw new Error("Invalid token");
  }
}

/** Token from `handshake.auth.token` first, then `?token=` query — both are the stored JWT. */
export function extractSocketToken(handshake: {
  auth?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): string | undefined {
  const fromAuth = handshake.auth?.token;
  if (typeof fromAuth === "string" && fromAuth) return fromAuth;
  const fromQuery = handshake.query?.token;
  if (typeof fromQuery === "string" && fromQuery) return fromQuery;
  return undefined;
}

/**
 * Room authorisation (pure, unit-tested): a socket may only join a
 * ticket room when the ticket's tenant matches the socket's tenant.
 * Returns the room name on success; throws on a cross-tenant join.
 */
export function assertTicketRoom(
  ticketTenantId: string | null | undefined,
  socketTenantId: string,
  ticketId: string,
): string {
  if (!ticketTenantId || ticketTenantId !== socketTenantId) {
    throw new Error(`Cross-tenant ticket join rejected: ticket ${ticketId}`);
  }
  return `ticket:${ticketId}`;
}

/** Workspace room name for a tenant — the socket auto-joins this on connect. */
export function workspaceRoom(tenantId: string): string {
  return `workspace:${tenantId}`;
}
