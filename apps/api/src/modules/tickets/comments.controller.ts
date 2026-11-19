import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { createCommentSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { CommentsService } from "./comments.service";

type ReqUser = { user?: { id?: string } };

/**
 * Ticket comments. The two ticket-nested routes live here (not on
 * TicketsController) so DELETE can sit at its natural top-level path
 * `/comments/:id` — one controller, one service, one module.
 */
@ApiTags("comments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post("tickets/:id/comments")
  @RequirePermissions("TICKETS_COMMENT")
  @ApiOperation({ summary: "Add a comment to a ticket" })
  @ApiResponse({ status: 201, description: "Comment created; fires the comment.created automation event" })
  @ApiResponse({ status: 404, description: "Ticket not found in this tenant" })
  create(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = createCommentSchema.parse(body);
    return this.comments.create(tenantId, id, req.user?.id ?? "unknown", parsed.body);
  }

  @Get("tickets/:id/comments")
  @RequirePermissions("TICKETS_COMMENT")
  @ApiOperation({ summary: "List a ticket's comments, oldest first" })
  @ApiResponse({ status: 200, description: "Comments for the ticket" })
  @ApiResponse({ status: 404, description: "Ticket not found in this tenant" })
  list(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.comments.list(tenantId, id);
  }

  @Delete("comments/:id")
  @RequirePermissions("TICKETS_COMMENT")
  @ApiOperation({ summary: "Delete a comment (author or workspace admin only)" })
  @ApiResponse({ status: 200, description: "Comment deleted" })
  @ApiResponse({ status: 403, description: "Caller is neither the author nor a workspace admin" })
  @ApiResponse({ status: 404, description: "Comment not found in this tenant" })
  remove(@TenantId() tenantId: string, @Req() req: ReqUser, @Param("id") id: string) {
    return this.comments.remove(tenantId, id, req.user?.id ?? "unknown");
  }
}
