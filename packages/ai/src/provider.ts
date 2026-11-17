import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Single provider interface for every LLM in the platform.
 *
 * One env var — AI_PROVIDER — picks the backend; swapping models needs no
 * code change, only env. The API agent (apps/api) and the worker
 * (apps/worker) both build their models through createChatModel() here,
 * so provider logic lives in exactly one place.
 *
 * FREE vs PAID — read this before assuming anything is free:
 * - LangChain.js is free/open-source software. It does NOT make LLMs free.
 * - The OpenAI SDK library is likewise free/open-source; OpenAI's API
 *   usage is billed per token. Same split for every provider below.
 * - What costs money is the provider's API usage. The free tiers below
 *   cost $0 within their quotas, and Ollama (local) is truly free because
 *   you run the model on your own hardware.
 */
export type AiProvider = "gemini" | "openrouter" | "groq" | "ollama" | "openai";

export interface AiConfig {
  provider: AiProvider;
  model: string;
  temperature: number;
}

/** Free-tier-friendly default model per provider (override with AI_MODEL). */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3.1",
  openai: "gpt-4o-mini",
};

const PROVIDERS: readonly AiProvider[] = ["gemini", "openrouter", "groq", "ollama", "openai"];

/** API-key env var per provider (Ollama needs none — it is local). */
const KEY_ENV: Record<Exclude<AiProvider, "ollama">, string[]> = {
  gemini: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  groq: ["GROQ_API_KEY"],
  openai: ["OPENAI_API_KEY"],
};

function readKey(provider: AiProvider, env: NodeJS.ProcessEnv): string | undefined {
  if (provider === "ollama") return undefined;
  for (const name of KEY_ENV[provider]) {
    if (env[name]) return env[name];
  }
  return undefined;
}

/**
 * Resolve the AI config from env. Returns null when the selected provider
 * has no API key configured — callers must treat null as "AI disabled"
 * (HTTP 503, not a crash, never a fake answer).
 */
export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig | null {
  const raw = (env.AI_PROVIDER ?? "gemini").toLowerCase();
  const provider = (PROVIDERS.includes(raw as AiProvider) ? raw : "gemini") as AiProvider;
  const apiKey = readKey(provider, env);
  if (provider !== "ollama" && !apiKey) return null;
  return {
    provider,
    model: env.AI_MODEL ?? DEFAULT_MODELS[provider],
    temperature: Number(env.AI_TEMPERATURE ?? 0.2),
  };
}

export function isAiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readAiConfig(env) !== null;
}

/** Safe to log/return: provider + model only, never keys. */
export function describeAiProvider(env: NodeJS.ProcessEnv = process.env): {
  provider: AiProvider;
  model: string;
  configured: boolean;
} {
  const config = readAiConfig(env);
  const provider = ((env.AI_PROVIDER ?? "gemini").toLowerCase() as AiProvider) || "gemini";
  return {
    provider: PROVIDERS.includes(provider) ? provider : "gemini",
    model: config?.model ?? env.AI_MODEL ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.gemini,
    configured: config !== null,
  };
}

/**
 * Build the LangChain chat model for the configured provider.
 * Returns null when no provider is configured (no key) — the caller
 * returns 503. No live LLM call happens here, only client construction.
 */
export function createChatModel(env: NodeJS.ProcessEnv = process.env): BaseChatModel | null {
  const config = readAiConfig(env);
  if (!config) return null;
  switch (config.provider) {
    case "gemini":
      return new ChatGoogleGenerativeAI({
        apiKey: readKey("gemini", env),
        model: config.model,
        temperature: config.temperature,
      });
    case "openrouter":
      return new ChatOpenAI({
        apiKey: readKey("openrouter", env),
        configuration: { baseURL: "https://openrouter.ai/api/v1" },
        model: config.model,
        temperature: config.temperature,
      });
    case "groq":
      return new ChatGroq({
        apiKey: readKey("groq", env),
        model: config.model,
        temperature: config.temperature,
      });
    case "ollama":
      return new ChatOllama({
        baseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        model: config.model,
        temperature: config.temperature,
      });
    case "openai":
      return new ChatOpenAI({
        apiKey: readKey("openai", env),
        model: config.model,
        temperature: config.temperature,
      });
  }
}

/**
 * Per-workspace AI budget (cost control). Recorded on the workspace/tenant
 * and checked by the worker before each LLM call — enforcement is a TODO
 * until the billing slice lands (see docs/AI.md §6). Units are USD/month
 * unless the provider bills differently; token counts come from the
 * model's usage_metadata on every response.
 */
export interface AiBudget {
  tenantId: string;
  monthlyUsdCap: number;
  maxTokensPerRequest: number;
}
