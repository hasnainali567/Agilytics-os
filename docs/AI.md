# AI — LangChain.js agents (not single chat calls)

## 1. What this is

The AI layer is built on **LangChain.js as the agent framework**, because the
platform needs completely automated agents — tools, memory, RAG, multi-step
reasoning — not just one-shot chat completions.

- **API agent** — `apps/api/src/modules/ai/`: a LangChain agent behind
  `POST /api/v1/ai/ask` ("ask your workspace"). It calls read-only tools
  wired to our own services (ticket counts, projects, sprint progress) and
  answers from real workspace data.
- **Worker** — `apps/worker/src/ai/ai.service.ts`: long-running jobs
  (weekly summaries, digests) that run off-request via SQS.
- **Provider package** — `packages/ai`: the single provider interface.
  Both the API and the worker build their models through
  `createChatModel()` there, so swapping providers needs no code change.
- **RAG** — Postgres `pgvector` (already in the Prisma migration) for
  workspace-scoped retrieval. The embedding + retrieval wiring is a TODO
  until the first RAG slice; nothing retrieves across tenants, ever.

## 2. Free vs paid — the distinction, stated once, correctly

- **LangChain.js is free/open-source software. It does NOT make LLMs free.**
  It is a framework; you still pay the underlying LLM provider for API
  usage, unless you use a free tier or run a model locally.
- **The OpenAI SDK library is likewise free/open-source.** What is paid is
  OpenAI's API usage, billed per token. The same split applies to every
  provider: the client library costs $0, the tokens cost money.
- **The OpenAI SDK is NOT the primary client in this codebase** (it was
  removed from `apps/worker` in the 2026-11-17 correction). LangChain
  provider adapters (`@langchain/openai`, `@langchain/google-genai`,
  `@langchain/groq`, `@langchain/ollama`) are the only LLM clients.
  OpenAI remains available as a _paid fallback provider_ via
  `@langchain/openai` — it is never the default.

## 3. Providers — free / low-cost first for dev, paid for real data

**AI privacy rule (feature rework, approved 2026-11-17): free tiers are
for dev and demo data only. Any pilot workspace with real client data
runs on a paid, no-retention provider — Gemini paid by default,
$20/workspace/month cap (Decision Sheet Q4), cap enforcement a Phase 3
gate.** Free-tier terms can allow the provider to train on inputs, which
contradicts the privacy boundary — so real client work never goes
through a free tier.

`AI_PROVIDER` picks the backend. `AI_MODEL` overrides the default model.
No provider is called unless its key is configured — otherwise the API
returns **503 `ai_not_configured`** and the worker logs a skip. No live
LLM call happens by default.

| Provider (`AI_PROVIDER`) | Key env                                | Default model                            | Cost / limits (real ones)                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gemini` (default)       | `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) | `gemini-2.5-flash`                       | Google AI Studio free tier: generous daily request cap, rate-limited per minute; no SLA; usage may be used to improve Google services on the free tier — check the current terms before putting customer data through it. Paid tier removes those limits. |
| `openrouter`             | `OPENROUTER_API_KEY`                   | `meta-llama/llama-3.3-70b-instruct:free` | `:free` models cost $0 but are rate-limited, lower priority, and can change or disappear without notice. A key is still required. Paid models are billed per token.                                                                                       |
| `groq`                   | `GROQ_API_KEY`                         | `llama-3.3-70b-versatile`                | Free tier: per-minute/per-day token + request caps, no SLA. Very fast inference; caps are the constraint, not speed.                                                                                                                                      |
| `ollama`                 | none (local)                           | `llama3.1`                               | Truly free — you run the model on your own hardware (`OLLAMA_BASE_URL`, default `http://localhost:11434`). Cost is your compute; quality/speed depend on your machine/GPU. No data leaves your network.                                                   |
| `openai` (paid fallback) | `OPENAI_API_KEY`                       | `gpt-4o-mini`                            | Billed per token, no free tier for API usage. Use when customers scale and free tiers stop being enough.                                                                                                                                                  |

**Production rule:** free tiers are for **dev and demo data only** —
rate limits, lower quotas, no SLA, and (for some) different data-use
terms make them unsuitable for production, and they must never carry
real client data. When customers scale, switch to a paid provider
(Gemini paid / OpenAI / Anthropic via a LangChain adapter) and turn on
the cost controls in §6. **Per-workspace cap enforcement is a Phase 3
gate, not a later nice-to-have:** the worker must check the workspace's
remaining budget before each call and refuse (503) when exhausted
($20/workspace/month default, Decision Sheet Q4).

## 4. Configuration

```bash
AI_PROVIDER=gemini            # gemini | openrouter | groq | ollama | openai
AI_MODEL=gemini-2.5-flash     # optional override of the provider default
AI_TEMPERATURE=0.2            # optional, default 0.2
GOOGLE_API_KEY=...            # for gemini
OPENROUTER_API_KEY=...        # for openrouter
GROQ_API_KEY=...              # for groq
OPENAI_API_KEY=...            # for openai (paid fallback)
OLLAMA_BASE_URL=http://localhost:11434   # for ollama
```

`GET /api/v1/ai/status` reports the configured provider + model
(never keys). Secrets live only in env / Secrets Manager — never in code.

## 5. Agent design

- **Tools first, chat second.** The agent (`agent.tools.ts`) exposes
  read-only tools: `ticket_status_counts`, `list_projects`,
  `sprint_status`. Every tool closes over the request's `tenantId` — the
  agent cannot read another tenant's data.
- **No write tools exist yet, by design.** Actions that change data
  (create ticket, move sprint) arrive in Phase 3, behind explicit user
  approval per action — e.g. create a ticket from a Slack message, draft
  a daily update. The system prompt also forbids inventing numbers.
- **Memory.** The agent runs with a LangGraph `MemorySaver` checkpointer,
  keyed by `tenant:user:thread`, so follow-up questions in a thread keep
  context. It is in-process and resets on restart — the production slice
  swaps it for a Postgres-backed checkpointer.
- **Multi-step.** `createAgent` (LangChain v1) loops tool calls until the
  model has what it needs, then answers. Token usage from every response
  (`usage_metadata`) is logged for cost tracking.

## 6. Cost control (per-workspace)

- Every LLM response logs provider, model and token usage (API agent +
  worker). That log is the raw material for billing.
- `AiBudget` (`packages/ai`) is the per-workspace cap record
  (`monthlyUsdCap`, `maxTokensPerRequest`). **Enforcement is a Phase 3
  gate:** the worker must check the workspace's remaining budget before
  each call and refuse (503) when exhausted. Until the billing slice
  lands, the only safe guardrail is: free tiers for dev/demo data only,
  paid provider for real pilot data.
- Until then: free-tier providers + low temperature + short prompts are
  the practical guardrails, and `AI_PROVIDER=ollama` removes API cost
  entirely for local/dev use.

## 7. What is NOT built yet

- RAG retrieval (embeddings, pgvector queries, doc ingestion).
- Postgres-backed agent memory (checkpointer).
- Write/action tools (create ticket, move sprint, post to Slack).
- Per-workspace budget enforcement + cost dashboard.
- Anthropic adapter (`@langchain/anthropic`) — add it the same way as the
  other adapters in `packages/ai` when a customer asks for Claude.
- Any live LLM call in tests or CI — tests must run with no key and assert
  the 503 path.
