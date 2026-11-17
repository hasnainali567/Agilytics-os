import { Injectable, Logger } from "@nestjs/common";
import { createChatModel, describeAiProvider } from "@agilytics/ai";

/**
 * AI service (worker). LangChain.js is the agent framework — the model is
 * built through @agilytics/ai, so the provider is picked by AI_PROVIDER
 * and no code change is needed to swap Gemini / OpenRouter / Groq /
 * Ollama / OpenAI (see docs/AI.md).
 *
 * No live LLM call runs without a configured provider key. Usage
 * (tokens) is logged on every call for cost tracking; per-workspace
 * caps are enforced once the billing slice lands (docs/AI.md §6).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  /** TODO: wire the weekly-summary prompt + workspace-scoped RAG (pgvector). */
  async summarize(tenantId: string, text: string): Promise<string> {
    const model = createChatModel();
    if (!model) {
      this.logger.log(`AI summarize skipped for tenant ${tenantId}: no provider configured`);
      return "AI summary is not wired yet — set AI_PROVIDER and its API key (see docs/AI.md).";
    }
    const info = describeAiProvider();
    const result = await model.invoke([
      {
        role: "system",
        content:
          "You are the Agilytics reporting assistant. Summarise the workspace text below in short, factual bullet points. Never invent numbers.",
      },
      { role: "user", content: text.slice(0, 8000) },
    ]);
    const usage = (result as { usage_metadata?: unknown }).usage_metadata;
    this.logger.log(
      `AI summarize tenant=${tenantId} provider=${info.provider} model=${info.model} usage=${JSON.stringify(usage ?? null)}`,
    );
    return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
  }
}
