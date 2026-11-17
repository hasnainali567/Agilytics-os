import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

/**
 * Platform-admin guard. Runs after JwtAuthGuard.
 * The JWT must carry platformRole = "PLATFORM_ADMIN" (set in Cognito as a
 * custom claim, managed by the platform — never self-asserted by a tenant).
 * PLATFORM_SUPPORT is read-only and is NOT granted by this guard.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ platformRole?: string }>();
    if (req.platformRole !== "PLATFORM_ADMIN") {
      throw new ForbiddenException("Platform admin access required");
    }
    return true;
  }
}
