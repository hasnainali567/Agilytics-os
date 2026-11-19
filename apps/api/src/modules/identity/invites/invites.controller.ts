import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant.decorator";
import { InvitesService } from "./invites.service";

type ReqUser = { user?: { id?: string } };

const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  roleId: z.string().min(1),
});

/**
 * Member invites — invite first, account later.
 *
 * POST /members/invite needs MEMBERS_INVITE (OWNER / ADMIN / LEAD
 * hold it). It creates an Invite row with a random token and a
 * 7-day expiry — NO user account is created yet. The token is
 * returned in the response in dev because there is no email sender
 * yet; in production it goes out by email (SES) and is never
 * returned. Accept needs no permission (any authenticated user
 * accepts their own invite); revoke needs MEMBERS_INVITE.
 */
@ApiTags("members")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("members")
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post("invite")
  @RequirePermissions("MEMBERS_INVITE")
  @ApiOperation({
    summary: "Invite a member by email (creates an invite, not an account)",
    description:
      "Creates a pending invite with a random token, expiring in 7 days. " +
      "The token is returned in dev because there is no email sender yet — " +
      "in production it is emailed and never returned.",
  })
  @ApiResponse({ status: 201, description: "Invite created (includes the token in dev)" })
  @ApiResponse({ status: 404, description: "Role not found in this workspace" })
  @ApiResponse({ status: 409, description: "Email already a member, or already has a pending invite" })
  create(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Body() body: unknown,
  ) {
    const parsed = createInviteSchema.parse(body);
    return this.invites.createInvite(tenantId, req.user?.id ?? "unknown", parsed);
  }

  @Get("invites")
  @RequirePermissions("MEMBERS_INVITE")
  @ApiOperation({ summary: "List pending invites for this workspace (tokens never included)" })
  @ApiResponse({ status: 200, description: "Pending invites, newest first" })
  list(@TenantId() tenantId: string) {
    return this.invites.listInvites(tenantId);
  }

  @Post("invites/:token/accept")
  @ApiOperation({
    summary: "Accept an invite — creates/updates the membership with the invited role",
    description:
      "Authenticated by the caller's dev-login user id. The invite's own tenant is " +
      "authoritative: accepting is how a user joins a workspace.",
  })
  @ApiResponse({ status: 201, description: "Membership created/updated, invite marked ACCEPTED" })
  @ApiResponse({ status: 404, description: "Invite not found" })
  @ApiResponse({ status: 409, description: "Invite already accepted / revoked" })
  @ApiResponse({ status: 410, description: "Invite expired" })
  accept(@Param("token") token: string, @Req() req: ReqUser) {
    return this.invites.acceptInvite(token, req.user?.id ?? "unknown");
  }

  @Delete("invites/:id")
  @RequirePermissions("MEMBERS_INVITE")
  @ApiOperation({ summary: "Revoke a pending invite" })
  @ApiResponse({ status: 200, description: "Invite revoked" })
  @ApiResponse({ status: 404, description: "Invite not found in this workspace" })
  @ApiResponse({ status: 409, description: "Invite is not pending" })
  revoke(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
  ) {
    return this.invites.revokeInvite(tenantId, req.user?.id ?? "unknown", id);
  }
}
