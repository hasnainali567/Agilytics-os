import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verify } from "jsonwebtoken";

/**
 * JWT guard — LOCAL DEV placeholder, ready for Cognito.
 *
 * Local dev: verifies a symmetric JWT signed with JWT_SECRET.
 * Production: replace the verify() call with JWKS verification against
 * https://cognito-idp.<region>.amazonaws.com/<poolId>/.well-known/jwks.json
 * and read `custom:tenant_id` from the token claims into req.tenantId.
 * See apps/api/README.md for the full wiring checklist.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      tenantId?: string;
      platformRole?: string;
      user?: unknown;
    }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new UnauthorizedException("JWT_SECRET is not configured");
    }
    try {
      const payload = verify(auth.slice("Bearer ".length), secret) as {
        sub?: string;
        tenantId?: string;
        platformRole?: string;
        "custom:tenant_id"?: string;
        "custom:platform_role"?: string;
      };
      req.user = { id: payload.sub };
      req.tenantId = payload["custom:tenant_id"] ?? payload.tenantId ?? "demo-tenant";
      // PlatformAdminGuard (runs after this guard) reads req.platformRole.
      req.platformRole = payload.platformRole ?? payload["custom:platform_role"];
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
