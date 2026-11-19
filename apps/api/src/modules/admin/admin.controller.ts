import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
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

  @ApiOperation({ summary: "Organisations" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("organisations")
  organisations() {
    return this.admin.listOrganisations();
  }

  @ApiOperation({ summary: "Users" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("users")
  users() {
    return this.admin.listUsers();
  }

  @ApiOperation({ summary: "Audit logs" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("audit-logs")
  auditLogs(@Query("tenantId") tenantId?: string) {
    return this.admin.listAuditLogs(tenantId);
  }

  @ApiOperation({ summary: "Health" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("health")
  health() {
    return this.admin.systemHealth();
  }
}
