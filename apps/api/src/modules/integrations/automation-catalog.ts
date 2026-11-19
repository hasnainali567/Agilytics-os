import type { AutomationAction, AutomationTrigger } from "@agilytics/shared";
import type { AutomationEventContext } from "../../common/automation-events";

/**
 * Automation catalog — pure helpers, no DB, no SDK calls (unit-tested
 * in automation-catalog.spec.ts). Adding a trigger/action is one entry
 * in packages/shared (the catalog) + one executor branch in
 * AutomationService.executeAction. Nothing else changes.
 */

export type RuleConfig = Record<string, unknown>;

export interface AutomationRuleRow {
  id: string;
  tenantId: string;
  name: string;
  trigger: string;
  action: string;
  config: RuleConfig | null;
  isActive: boolean;
}

/** Optional narrowing stored under `config.filters` on a rule. */
export interface RuleFilters {
  /** Only fire when the ticket moves INTO this column category. */
  toCategory?: string;
  projectId?: string;
  priority?: string;
  assigneeId?: string;
}

export function ruleFilters(config: RuleConfig | null | undefined): RuleFilters {
  const raw = config?.["filters"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const f = raw as Record<string, unknown>;
  const pick = (k: string) => (typeof f[k] === "string" && f[k] ? (f[k] as string) : undefined);
  return {
    toCategory: pick("toCategory"),
    projectId: pick("projectId"),
    priority: pick("priority"),
    assigneeId: pick("assigneeId"),
  };
}

/**
 * A rule fires only when every filter it sets matches the event
 * context. A rule with no filters fires on every event of its trigger.
 * Unknown filter keys are ignored (forward-compatible).
 */
export function matchesFilters(
  config: RuleConfig | null | undefined,
  ctx: AutomationEventContext,
): boolean {
  const f = ruleFilters(config);
  if (f.toCategory && ctx.toCategory !== f.toCategory) return false;
  if (f.projectId && ctx.projectId !== f.projectId) return false;
  if (f.priority && ctx.priority !== f.priority) return false;
  if (f.assigneeId && ctx.assigneeId !== f.assigneeId) return false;
  return true;
}

const TEMPLATE_VARS: Record<string, (ctx: AutomationEventContext) => string> = {
  "ticket.key": (c) => c.ticketKey ?? "",
  "ticket.title": (c) => c.ticketTitle ?? "",
  "ticket.id": (c) => c.ticketId ?? "",
  trigger: () => "",
  assigneeId: (c) => c.assigneeId ?? "",
  projectId: (c) => c.projectId ?? "",
  "sprint.name": (c) => c.sprintName ?? "",
  text: (c) => c.text ?? "",
};

/** Replace `{ticket.key}`-style placeholders; unknown ones are left as-is. */
export function renderTemplate(
  template: string,
  trigger: AutomationTrigger,
  ctx: AutomationEventContext,
): string {
  return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (whole, key: string) => {
    if (key === "trigger") return trigger;
    const fn = TEMPLATE_VARS[key];
    return fn ? fn(ctx) : whole;
  });
}

/** Default message per trigger when a rule sets no template. */
export function defaultMessage(trigger: AutomationTrigger, ctx: AutomationEventContext): string {
  const ticket = ctx.ticketKey ? `${ctx.ticketKey}: ${ctx.ticketTitle ?? ""}`.trim() : "a ticket";
  switch (trigger) {
    case "ticket.created":
      return `Ticket created — ${ticket}`;
    case "ticket.status_changed":
      return `Ticket ${ticket} moved${ctx.toCategory ? ` to ${ctx.toCategory}` : ""}`;
    case "ticket.overdue":
      return `Ticket ${ticket} is overdue — no daily update in 3 days`;
    case "ticket.done":
      return `Ticket done — ${ticket}`;
    case "sprint.completed":
      return `Sprint completed — ${ctx.sprintName ?? ctx.sprintId ?? ""}`.trim();
    case "daily_update.created":
      return `Daily update posted${ctx.ticketKey ? ` on ${ticket}` : ""}`;
    case "comment.created":
      return `New comment${ctx.ticketKey ? ` on ${ticket}` : ""}`;
    default:
      return `Automation event ${trigger} — ${ticket}`;
  }
}

export type { AutomationAction, AutomationTrigger };
