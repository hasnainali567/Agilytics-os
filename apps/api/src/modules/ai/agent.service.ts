import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { createChatModel } from "@agilytics/ai";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { buildAgentTools } from "./agent.tools";
import { PrismaService } from "../../prisma/prisma.service";

const SYSTEM_PROMPT = [
  "You are the Agilytics workspace assistant.",
  "Answer only about this workspace, using the read-only tools provided.",
  "Never invent tickets, projects or numbers — if a tool returns nothing, say so.",
  "Keep answers short and factual. You cannot change anything; you only read.",
].join(" ");

/**
 * LangChain agent (API side). Tools, memory and multi-step reasoning live
 * here; the worker (apps/worker) handles long-running jobs. The model is
 * built per request from @agilytics/ai so swapping providers needs no
 * code change — set AI_PROVIDER. No key configured => 503, never a
 * hallucinated answer.
 *
 * Memory: an in-process MemorySaver checkpointer keyed by
 * tenant:user:thread. It resets on restart — the production slice swaps
 * it for a Postgres-backed checkpointer (see docs/AI.md §5).
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly checkpointer = new MemorySaver();

  constructor(private readonly prisma: PrismaService) {}

  async ask(tenantId: string, userId: string, question: string, threadId = "default") {
    const model = createChatModel();
    if (!model) {
      throw new ServiceUnavailableException({
        code: "ai_not_configured",
        message:
          "No AI provider is configured — set AI_PROVIDER and its API key (see docs/AI.md). No live LLM call was made.",
      });
    }
    const agent = createAgent({
      model,
      tools: buildAgentTools(this.prisma, tenantId),
      systemPrompt: SYSTEM_PROMPT,
      checkpointer: this.checkpointer,
    });
    const result = await agent.invoke(
      { messages: [{ role: "user", content: question }] },
      { configurable: { thread_id: `${tenantId}:${userId}:${threadId}` } },
    );
    const last = result.messages[result.messages.length - 1];
    const content = last?.content;
    const answer =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((p) => (typeof p === "string" ? p : "text" in p ? p.text : "")).join("")
          : "";
    const usage = (last as { usage_metadata?: unknown } | undefined)?.usage_metadata;
    this.logger.log(`agent ask tenant=${tenantId} usage=${JSON.stringify(usage ?? null)}`);
    return { answer, threadId };
  }
}
