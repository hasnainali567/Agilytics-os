import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { describeAiProvider } from "@agilytics/ai";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { AgentService } from "./agent.service";

export class AskAgentDto {
  @IsString()
  @MaxLength(2000)
  question!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  threadId?: string;
}

/**
 * AI — LangChain agent ("ask your workspace"), RAG summaries.
 * The agent endpoint runs the LangChain agent with read-only workspace
 * tools (see agent.tools.ts). With no provider key configured it returns
 * 503 with code ai_not_configured — never a fake answer.
 */
@ApiTags("ai")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("ai")
export class AiController {
  constructor(private readonly agent: AgentService) {}

  @Get("status")
  status() {
    // Provider + model only — never keys (see @agilytics/ai).
    return {
      ...describeAiProvider(),
      agent: "langchain",
      tools: ["ticket_status_counts", "list_projects", "sprint_status"],
    };
  }

  @Post("ask")
  ask(
    @TenantId() tenantId: string,
    @Req() req: { user?: { id?: string } },
    @Body() body: AskAgentDto,
  ) {
    return this.agent.ask(tenantId, req.user?.id ?? "unknown", body.question, body.threadId);
  }

  @Post("summary")
  summary(@TenantId() tenantId: string, @Body() body: { scope?: string }) {
    return {
      status: "not_configured",
      tenantId,
      scope: body.scope ?? "workspace",
      message: "AI summaries run as worker jobs — see apps/worker and docs/AI.md §4.",
    };
  }
}
