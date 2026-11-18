import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import {
  RequireAnyPermission,
  RequirePermissions,
} from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant.decorator";
import { RolesService } from "./roles.service";

type ReqUser = { user?: { id?: string } };

const colourSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "colour must be a hex colour like #0F3D20")
  .optional();

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  colour: colourSchema,
  permissions: z.array(z.string()).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  colour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "colour must be a hex colour like #0F3D20")
    .nullable()
    .optional(),
});

const replacePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

const assignRoleSchema = z.object({
  roleId: z.string().min(1),
});

/**
 * Roles & permissions (decision 21). Workspace-admin surface — the
 * company's own admin/head, NOT the platform admin.
 *
 * Enforcement is PermissionsGuard (server-side, deny-by-default); the
 * Roles matrix UI hiding a toggle is cosmetic only. Every mutation
 * also writes to the AuditLog via RolesService.
 */
@ApiTags("roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** Fixed 42-key catalog, grouped by area — drives the matrix rows. */
  @Get("permissions")
  @RequireAnyPermission("ROLES_MANAGE", "MEMBERS_ASSIGN_ROLE")
  catalog() {
    return this.roles.listPermissionCatalog();
  }

  @Get()
  @RequireAnyPermission("ROLES_MANAGE", "MEMBERS_ASSIGN_ROLE")
  list(@TenantId() tenantId: string) {
    return this.roles.listRoles(tenantId);
  }

  @Get(":id")
  @RequireAnyPermission("ROLES_MANAGE", "MEMBERS_ASSIGN_ROLE")
  get(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.roles.getRole(tenantId, id);
  }

  @Post()
  @RequirePermissions("ROLES_MANAGE")
  create(@TenantId() tenantId: string, @Req() req: ReqUser, @Body() body: unknown) {
    const parsed = createRoleSchema.parse(body);
    return this.roles.createRole(tenantId, req.user?.id ?? "unknown", parsed);
  }

  @Patch(":id")
  @RequirePermissions("ROLES_MANAGE")
  update(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateRoleSchema.parse(body);
    return this.roles.updateRole(tenantId, req.user?.id ?? "unknown", id, parsed);
  }

  @Delete(":id")
  @RequirePermissions("ROLES_MANAGE")
  remove(@TenantId() tenantId: string, @Req() req: ReqUser, @Param("id") id: string) {
    return this.roles.deleteRole(tenantId, req.user?.id ?? "unknown", id);
  }

  /** Replace the role's whole permission set (matrix save). */
  @Put(":id/permissions")
  @RequirePermissions("ROLES_MANAGE")
  replacePermissions(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = replacePermissionsSchema.parse(body);
    return this.roles.replacePermissions(
      tenantId,
      req.user?.id ?? "unknown",
      id,
      parsed.permissions,
    );
  }

  /** Assign a role to a member — the role dropdown on invite/edit. */
  @Patch("members/:membershipId/role")
  @RequirePermissions("MEMBERS_ASSIGN_ROLE")
  assignRole(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
  ) {
    const parsed = assignRoleSchema.parse(body);
    return this.roles.assignRole(tenantId, req.user?.id ?? "unknown", membershipId, parsed.roleId);
  }
}
