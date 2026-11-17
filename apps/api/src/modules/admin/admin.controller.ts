import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PlatformAdminGuard } from "../../common/guards/platform-admin.guard";
import { AdminService } from "./admin.service";

/**
 * Platform Admin API — controls the whole platform.
 * Guarded by JWT + PLATFORM_ADMIN. Every call here should also write an
 * AuditLog entry (TODO: audit interceptor). No impersonation endpoint exists.
 */
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("organisations")
  organisations() {
    return this.admin.listOrganisations();
  }

  @Get("users")
  users() {
    return this.admin.listUsers();
  }

  @Get("audit-logs")
  auditLogs(@Query("tenantId") tenantId?: string) {
    return this.admin.listAuditLogs(tenantId);
  }

  @Get("health")
  health() {
    return this.admin.systemHealth();
  }
}
