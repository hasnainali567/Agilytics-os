import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createBoardColumnSchema,
  createBoardSchema,
  updateBoardColumnSchema,
} from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { BoardsService } from "./boards.service";

type ReqUser = { user?: { id?: string } };

/**
 * Boards / custom workflows — unlimited boards per project, unlimited
 * workspace-admin-defined statuses per board. See docs/WORKFLOWS.md.
 * Reads are open to workspace members; mutations require OWNER/ADMIN.
 */
@ApiTags("boards")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("boards")
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query("projectId") projectId?: string) {
    return this.boards.list(tenantId, projectId);
  }

  @Get(":id")
  get(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.boards.get(tenantId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Req() req: ReqUser, @Body() body: unknown) {
    const parsed = createBoardSchema.parse(body);
    return this.boards.create(tenantId, req.user?.id ?? "unknown", parsed);
  }

  @Post(":id/columns")
  addColumn(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = createBoardColumnSchema.parse(body);
    return this.boards.addColumn(tenantId, req.user?.id ?? "unknown", id, parsed);
  }

  @Patch(":boardId/columns/:columnId")
  updateColumn(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("boardId") boardId: string,
    @Param("columnId") columnId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateBoardColumnSchema.parse(body);
    return this.boards.updateColumn(tenantId, req.user?.id ?? "unknown", boardId, columnId, parsed);
  }

  @Delete(":boardId/columns/:columnId")
  deleteColumn(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("boardId") boardId: string,
    @Param("columnId") columnId: string,
    @Body() body: { moveTicketsToColumnId?: string },
  ) {
    return this.boards.deleteColumn(
      tenantId,
      req.user?.id ?? "unknown",
      boardId,
      columnId,
      body?.moveTicketsToColumnId,
    );
  }

  @Delete(":id")
  deleteBoard(@TenantId() tenantId: string, @Req() req: ReqUser, @Param("id") id: string) {
    return this.boards.deleteBoard(tenantId, req.user?.id ?? "unknown", id);
  }
}
