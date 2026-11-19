import { BadRequestException, Injectable, Logger, NotFoundException, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  type AutomationAction,
  type AutomationTrigger,
  type CreateAutomationRuleInput,
  type UpdateAutomationRuleInput,
} from "@agilytics/shared";
import { automationEvents, type AutomationEvent, type AutomationEventContext } from "../../common/automation-events";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TicketsService } from "../tickets/tickets.service";
import { IntegrationsService } from "./integrations.service";
import {
  defaultMessage,
  matchesFilters,
  renderTemplate,
  type RuleConfig,
} from "./automation-catalog";
import { GitHubProvider } from "./providers/github.provider";
import { SlackProvider } from "./providers/slack.provider";

/** Same stale rule as ReportingService: not done + no daily update in 3 days. */
const STALE_AFTER_DAYS = 3;

export interface AutomationOutcome {
  ruleId: string;
  ruleName: string;
  action: string;
  ok: boolean;
  result: string;
}

export interface EvaluateResult {
  trigger: AutomationTrigger;
  evaluated: number;
  outcomes: AutomationOutcome[];
}

/**
 * Automation rules — trigger → action evaluator + CRUD.
 *
 * Tenant scoping: every query is `where: { tenantId, … }`; RLS on
 * `automation_rules` enforces the same boundary at the DB layer.
 * Permission: the controller guards mutations with AUTOMATIONS_MANAGE
 * (an existing catalog key — OWNER/ADMIN hold it; see permission-catalog).
 * Every create/update/delete/toggle is written to AuditLog.
 *
 * Graceful degradation everywhere: an unconnected provider (Slack
 * without SLACK_BOT_TOKEN, GitHub without GITHUB_TOKEN), a missing
 * config value, or a failing webhook is a logged warning + a skipped
 * action — never a crash, never a failed request. `evaluate` itself
 * never throws.
 *
 * Catalog: triggers/actions are the fixed enums in packages/shared.
 * Adding one is one catalog entry + one branch in `executeAction`.
 *
 * Event wiring: `evaluate` is called from the automation event bus
 * (see common/automation-events.ts) — TicketsService emits
 * ticket.created / ticket.status_changed / ticket.done,
 * DailyUpdatesService emits daily_update.created. `comment.created`
 * and `sprint.completed` are in the catalog but have no event site
 * yet: there is no comments endpoint and no sprint-complete endpoint
 * in this slice, so nothing emits them (documented in the controller
 * + docs/INTEGRATIONS.md). `ticket.overdue` runs from `runSweep`,
 * called by POST /integrations/automations/sweep (worker/scheduler).
 */
@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slack: SlackProvider,
    private readonly github: GitHubProvider,
    private readonly notifications: NotificationsService,
    private readonly tickets: TicketsService,
    private readonly integrations: IntegrationsService,
  ) {}

  onModuleInit() {
    automationEvents.on("automation", (event: AutomationEvent) => {
      void this.evaluate(event.trigger, event.tenantId, event.context).catch((err: unknown) => {
        this.logger.warn(
          `Automation evaluate failed for ${event.trigger}: ${(err as Error).message}`,
        );
      });
    });
  }

  // --- CRUD (tenant-scoped) ---

  list(tenantId: string) {
    return this.prisma.automationRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(tenantId: string, input: unknown, userId?: string) {
    const parsed = this.parseCreate(input);
    const rule = await this.prisma.automationRule.create({
      data: {
        tenantId,
        name: parsed.name,
        trigger: parsed.trigger,
        action: parsed.action,
        config: (parsed.config ?? {}) as unknown as Prisma.InputJsonValue,
        isActive: parsed.isActive ?? true,
      },
    });
    await this.integrations.audit(tenantId, "automation.create", "AutomationRule", rule.id, {
      name: rule.name,
      trigger: rule.trigger,
      action: rule.action,
    }, userId);
    return rule;
  }

  async update(tenantId: string, id: string, input: unknown, userId?: string) {
    const parsed = this.parseUpdate(input);
    const existing = await this.prisma.automationRule.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Automation rule not found in this tenant");
    const rule = await this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.trigger !== undefined ? { trigger: parsed.trigger } : {}),
        ...(parsed.action !== undefined ? { action: parsed.action } : {}),
        ...(parsed.config !== undefined ? { config: parsed.config as unknown as Prisma.InputJsonValue } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
    });
    await this.integrations.audit(tenantId, "automation.update", "AutomationRule", rule.id, {
      name: rule.name,
      trigger: rule.trigger,
      action: rule.action,
    }, userId);
    return rule;
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const existing = await this.prisma.automationRule.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Automation rule not found in this tenant");
    await this.prisma.automationRule.delete({ where: { id } });
    await this.integrations.audit(tenantId, "automation.delete", "AutomationRule", id, {
      name: existing.name,
      trigger: existing.trigger,
      action: existing.action,
    }, userId);
    return { id, deleted: true };
  }

  async toggle(tenantId: string, id: string, userId?: string) {
    const existing = await this.prisma.automationRule.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Automation rule not found in this tenant");
    const rule = await this.prisma.automationRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    await this.integrations.audit(tenantId, "automation.toggle", "AutomationRule", rule.id, {
      name: rule.name,
      isActive: rule.isActive,
    }, userId);
    return rule;
  }

  // --- Evaluator ---

  /** Load active rules for the trigger, apply filters, run actions. Never throws. */
  async evaluate(
    trigger: AutomationTrigger,
    tenantId: string,
    ctx: AutomationEventContext,
  ): Promise<EvaluateResult> {
    let rules: { id: string; name: string; trigger: string; action: string; config: unknown; isActive: boolean }[];
    try {
      rules = await this.prisma.automationRule.findMany({
        where: { tenantId, trigger, isActive: true },
        orderBy: { createdAt: "asc" },
      });
    } catch (err) {
      this.logger.warn(`Automation load failed for ${trigger}: ${(err as Error).message}`);
      return { trigger, evaluated: 0, outcomes: [] };
    }
    const outcomes: AutomationOutcome[] = [];
    for (const rule of rules) {
      const config = (rule.config ?? {}) as RuleConfig;
      if (!matchesFilters(config, ctx)) {
        outcomes.push({
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          ok: true,
          result: "skipped: filter mismatch",
        });
        continue;
      }
      try {
        const result = await this.executeAction(rule.action as AutomationAction, config, trigger, tenantId, ctx, rule.name);
        outcomes.push({ ruleId: rule.id, ruleName: rule.name, action: rule.action, ok: true, result });
      } catch (err) {
        const message = (err as Error).message;
        this.logger.warn(`Automation rule "${rule.name}" (${rule.action}) failed: ${message}`);
        outcomes.push({
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          ok: false,
          result: `failed: ${message}`,
        });
      }
    }
    return { trigger, evaluated: rules.length, outcomes };
  }

  /**
   * Overdue sweep — the `ticket.overdue` trigger. Finds tickets that are
   * not done and have had no daily update in 3 days (same rule as
   * ReportingService), then evaluates `ticket.overdue` rules for each.
   * Called by POST /integrations/automations/sweep; the worker /
   * scheduler calls that endpoint (see apps/worker JobsService
   * `automation.run` stub). Never throws.
   */
  async runSweep(tenantId: string): Promise<{ staleTickets: number; evaluated: number; outcomes: AutomationOutcome[] }> {
    const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    let tickets: {
      id: string;
      key: string;
      title: string;
      projectId: string;
      assigneeId: string | null;
      priority: string;
      status: { category: string } | null;
      dailyUpdates: { date: Date }[];
    }[];
    try {
      tickets = await this.prisma.ticket.findMany({
        where: { tenantId },
        include: {
          status: true,
          dailyUpdates: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
        },
      });
    } catch (err) {
      this.logger.warn(`Automation sweep load failed: ${(err as Error).message}`);
      return { staleTickets: 0, evaluated: 0, outcomes: [] };
    }
    const stale = tickets.filter((t) => {
      if (t.status?.category === "DONE") return false;
      const last = t.dailyUpdates[0]?.date;
      return !last || last.getTime() < cutoff.getTime();
    });
    const outcomes: AutomationOutcome[] = [];
    for (const ticket of stale) {
      const last = ticket.dailyUpdates[0]?.date;
      const daysStale = last
        ? Math.floor((Date.now() - last.getTime()) / (24 * 60 * 60 * 1000))
        : STALE_AFTER_DAYS;
      const result = await this.evaluate("ticket.overdue", tenantId, {
        ticketId: ticket.id,
        ticketKey: ticket.key,
        ticketTitle: ticket.title,
        projectId: ticket.projectId,
        assigneeId: ticket.assigneeId ?? undefined,
        priority: ticket.priority,
        text: `No daily update in ${daysStale} day(s).`,
      });
      outcomes.push(...result.outcomes);
    }
    return { staleTickets: stale.length, evaluated: outcomes.length, outcomes };
  }

  // --- Actions (one branch per action; unknown actions throw → caught by evaluate) ---

  private async executeAction(
    action: AutomationAction,
    config: RuleConfig,
    trigger: AutomationTrigger,
    tenantId: string,
    ctx: AutomationEventContext,
    ruleName: string,
  ): Promise<string> {
    switch (action) {
      case "slack.post":
        return this.actionSlackPost(config, trigger, ctx);
      case "github.comment":
        return this.actionGitHubComment(config, trigger, ctx);
      case "notification.create":
        return this.actionNotificationCreate(config, trigger, tenantId, ctx);
      case "ticket.update":
        return this.actionTicketUpdate(config, tenantId, ctx, ruleName);
      case "webhook.post":
        return this.actionWebhookPost(config, trigger, tenantId, ctx);
      default:
        throw new Error(`Unknown automation action: ${String(action)}`);
    }
  }

  private messageFor(config: RuleConfig, trigger: AutomationTrigger, ctx: AutomationEventContext): string {
    const template = config["template"];
    if (typeof template === "string" && template.trim()) {
      return renderTemplate(template, trigger, ctx);
    }
    const message = config["message"];
    if (typeof message === "string" && message.trim()) {
      return renderTemplate(message, trigger, ctx);
    }
    return defaultMessage(trigger, ctx);
  }

  private async actionSlackPost(
    config: RuleConfig,
    trigger: AutomationTrigger,
    ctx: AutomationEventContext,
  ): Promise<string> {
    const channel =
      (typeof config["channel"] === "string" && config["channel"]) || this.slack.defaultChannel();
    if (!channel) {
      this.logger.warn("slack.post skipped: no channel in rule config and SLACK_DEFAULT_CHANNEL unset");
      return "skipped: no Slack channel configured";
    }
    if (!this.slack.isConfigured()) {
      this.logger.warn("slack.post skipped: Slack is not connected (SLACK_BOT_TOKEN unset)");
      return "skipped: Slack not connected";
    }
    await this.slack.postMessage(channel, this.messageFor(config, trigger, ctx));
    return `posted to ${channel}`;
  }

  private async actionGitHubComment(
    config: RuleConfig,
    trigger: AutomationTrigger,
    ctx: AutomationEventContext,
  ): Promise<string> {
    const owner = config["owner"];
    const repo = config["repo"];
    const prNumber = config["prNumber"];
    if (typeof owner !== "string" || !owner || typeof repo !== "string" || !repo) {
      this.logger.warn("github.comment skipped: rule config needs owner + repo");
      return "skipped: github.comment needs config.owner + config.repo";
    }
    const pr = typeof prNumber === "number" ? prNumber : Number(prNumber);
    if (!Number.isInteger(pr) || pr <= 0) {
      this.logger.warn("github.comment skipped: rule config needs a numeric config.prNumber");
      return "skipped: github.comment needs config.prNumber";
    }
    const body = this.messageFor(config, trigger, ctx);
    // Worker (a) owns providers/github.provider.ts: when it gains a
    // commentOnPullRequest method this branch uses it; until then the
    // GitHub REST fallback below posts directly (GITHUB_TOKEN env only).
    const provider = this.github as unknown as {
      commentOnPullRequest?: (owner: string, repo: string, prNumber: number, body: string) => Promise<void>;
    };
    if (typeof provider.commentOnPullRequest === "function") {
      await provider.commentOnPullRequest(owner, repo, pr, body);
      return `commented on ${owner}/${repo}#${pr}`;
    }
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      this.logger.warn("github.comment skipped: GitHub not connected (GITHUB_TOKEN unset)");
      return "skipped: GitHub not connected";
    }
    // PRs are issues in the GitHub REST API, so a plain fetch posts the
    // comment — no Octokit import here (it is ESM-only and Jest cannot
    // require it in this repo's CJS test setup).
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${pr}/comments`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      this.logger.warn(`github.comment to ${owner}/${repo}#${pr} returned HTTP ${res.status}`);
      return `github.comment returned HTTP ${res.status}`;
    }
    return `commented on ${owner}/${repo}#${pr}`;
  }

  private async actionNotificationCreate(
    config: RuleConfig,
    trigger: AutomationTrigger,
    tenantId: string,
    ctx: AutomationEventContext,
  ): Promise<string> {
    const userId =
      (typeof config["userId"] === "string" && config["userId"]) ||
      ctx.assigneeId ||
      ctx.userId;
    if (!userId) {
      this.logger.warn("notification.create skipped: no assignee / userId to notify");
      return "skipped: no user to notify";
    }
    await this.notifications.createForUser(tenantId, userId, {
      type: "AUTOMATION",
      entity: "ticket",
      entityId: ctx.ticketId,
      title: this.messageFor(config, trigger, ctx),
    });
    return `notification created for ${userId}`;
  }

  private async actionTicketUpdate(
    config: RuleConfig,
    tenantId: string,
    ctx: AutomationEventContext,
    ruleName: string,
  ): Promise<string> {
    if (!ctx.ticketId) {
      this.logger.warn("ticket.update skipped: event has no ticket");
      return "skipped: event has no ticket";
    }
    const done: string[] = [];
    const statusCategory = config["statusCategory"];
    if (typeof statusCategory === "string" && ["TODO", "IN_PROGRESS", "DONE"].includes(statusCategory)) {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ctx.ticketId, tenantId },
        select: { boardId: true, projectId: true },
      });
      if (!ticket) return "skipped: ticket not found in this tenant";
      const column = await this.prisma.boardColumn.findFirst({
        where: {
          tenantId,
          category: statusCategory as "TODO" | "IN_PROGRESS" | "DONE",
          ...(ticket.boardId ? { boardId: ticket.boardId } : { board: { projectId: ticket.projectId } }),
        },
        orderBy: { order: "asc" },
      });
      if (!column) {
        this.logger.warn(`ticket.update skipped: no ${statusCategory} column for ticket ${ctx.ticketKey ?? ctx.ticketId}`);
      } else {
        // Status history is written by changeStatus — never update statusId directly.
        await this.tickets.changeStatus(tenantId, ctx.ticketId, column.id, undefined, `Automation rule ${ruleName}`);
        done.push(`status → ${statusCategory}`);
      }
    }
    const updates: { priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; assigneeId?: string } = {};
    if (typeof config["priority"] === "string" && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(config["priority"])) {
      updates.priority = config["priority"] as "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    }
    if (typeof config["assigneeId"] === "string" && config["assigneeId"]) {
      updates.assigneeId = config["assigneeId"];
    }
    if (Object.keys(updates).length > 0) {
      await this.prisma.ticket.updateMany({ where: { id: ctx.ticketId, tenantId }, data: updates });
      done.push(Object.keys(updates).join(", "));
    }
    return done.length > 0 ? `ticket updated (${done.join("; ")})` : "skipped: nothing to update in config";
  }

  private async actionWebhookPost(
    config: RuleConfig,
    trigger: AutomationTrigger,
    tenantId: string,
    ctx: AutomationEventContext,
  ): Promise<string> {
    const url = config["url"];
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      this.logger.warn("webhook.post skipped: rule config needs an http(s) config.url");
      return "skipped: webhook.post needs config.url";
    }
    const host = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "unknown host";
      }
    })();
    const payload: Record<string, unknown> = {
      trigger,
      tenantId,
      event: ctx,
      ...(typeof config["template"] === "string" && config["template"]
        ? { text: renderTemplate(config["template"], trigger, ctx) }
        : {}),
    };
    // Never log the URL (it may carry a secret query param) or the payload.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      this.logger.warn(`webhook.post to ${host} returned HTTP ${res.status}`);
      return `webhook returned HTTP ${res.status}`;
    }
    return `posted to ${host}`;
  }

  // --- Validation (shared Zod schemas; unknown trigger/action → 400) ---

  private parseCreate(input: unknown): CreateAutomationRuleInput {
    const parsed = createAutomationRuleSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid automation rule: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }
    return parsed.data;
  }

  private parseUpdate(input: unknown): UpdateAutomationRuleInput {
    const parsed = updateAutomationRuleSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid automation rule: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }
    return parsed.data;
  }
}
