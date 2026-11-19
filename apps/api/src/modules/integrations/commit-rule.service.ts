import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DailyUpdatesService } from "../daily-updates/daily-updates.service";
import { TicketsService } from "../tickets/tickets.service";
import { extractBranchTicketKey, resolveCommitAction, type CommitAction } from "./commit-rule";
import { SlackProvider } from "./providers/slack.provider";

/** One commit (push event) or one merged PR, as the webhook hands it over. */
export interface CommitInput {
  sha: string;
  message: string;
  authorEmail?: string;
  authorName?: string;
}

export interface CommitRuleOutcome {
  ticketKey: string;
  action: CommitAction;
  /** What actually happened — "moved", "skipped: …", "not-found". */
  result: string;
  ticketId?: string;
  slackPosted?: boolean;
  dailyUpdatePrefilled?: boolean;
}

/**
 * Applies the commit → ticket rule (commit-rule.ts) to real tickets.
 *
 * Chain (the automation the lost deal was about):
 *   commit closes ticket → ticket moves to a DONE column
 *     → Slack message to the configured channel
 *     → daily update pre-filled for the commit author
 *
 * Wiring — daily updates are NOT edited: the pre-fill is a plain service
 * call to DailyUpdatesService.upsertToday (call site: `prefillDailyUpdate`
 * below, one per member per ticket per day). Status moves go through
 * TicketsService.changeStatus so status history is written in the one
 * place that writes it. Tenant scoping: every ticket lookup is
 * `where: { tenantId, key }`; a key from another workspace never matches.
 *
 * Cross-module note: TicketsService / DailyUpdatesService are registered
 * as providers of IntegrationsModule (see integrations.module.ts) because
 * their own modules do not export them yet. The proper fix in a later
 * slice is `exports: [TicketsService]` / `exports: [DailyUpdatesService]`
 * on those modules — no other module's files were touched here.
 */
@Injectable()
export class CommitRuleService {
  private readonly logger = new Logger(CommitRuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
    private readonly dailyUpdates: DailyUpdatesService,
    private readonly slack: SlackProvider,
  ) {}

  /** Apply one push commit (message may name several tickets). */
  async applyCommit(tenantId: string, commit: CommitInput): Promise<CommitRuleOutcome[]> {
    const parsed = resolveCommitAction(commit.message);
    const outcomes: CommitRuleOutcome[] = [];
    for (const { key, action } of parsed.perKey) {
      outcomes.push(await this.applyToTicket(tenantId, key, action, commit));
    }
    return outcomes;
  }

  /** Apply a merged PR: keys from title + body + branch, all CLOSE. */
  async applyPullRequestMerged(
    tenantId: string,
    pr: {
      number: number;
      title: string;
      body?: string | null;
      headRef: string;
      mergedByEmail?: string;
      mergedByName?: string;
    },
  ): Promise<CommitRuleOutcome[]> {
    const text = `${pr.title}\n${pr.body ?? ""}`;
    const keys = new Set(resolveCommitAction(text).ticketKeys);
    const branchKey = extractBranchTicketKey(pr.headRef);
    if (branchKey) keys.add(branchKey);
    const outcomes: CommitRuleOutcome[] = [];
    for (const key of keys) {
      outcomes.push(
        await this.applyToTicket(tenantId, key, "CLOSE", {
          sha: `pr-${pr.number}`,
          message: `PR #${pr.number} merged: ${pr.title}`,
          authorEmail: pr.mergedByEmail,
          authorName: pr.mergedByName,
        }),
      );
    }
    return outcomes;
  }

  private async applyToTicket(
    tenantId: string,
    key: string,
    action: CommitAction,
    commit: CommitInput,
  ): Promise<CommitRuleOutcome> {
    const ticket = await this.prisma.ticket.findFirst({ where: { tenantId, key } });
    if (!ticket) {
      this.logger.warn(`Commit ${commit.sha} names unknown ticket ${key} in tenant ${tenantId}`);
      return { ticketKey: key, action, result: "skipped: ticket not found in this tenant" };
    }
    const outcome: CommitRuleOutcome = { ticketKey: key, action, ticketId: ticket.id, result: "" };

    if (action === "LINK") {
      outcome.result = "linked: mention recorded, ticket not moved";
    } else {
      // CLOSE → DONE column, START → IN_PROGRESS, REOPEN → TODO.
      const category = action === "CLOSE" ? "DONE" : action === "START" ? "IN_PROGRESS" : "TODO";
      const moved = await this.moveToCategory(tenantId, ticket, category, commit, key);
      if (!moved) {
        outcome.result = `skipped: no ${category} column on this ticket's board`;
        return outcome;
      }
      outcome.result = `moved to ${category} column`;
    }

    // Slack notification — best effort, never fails the ticket move.
    const channel = this.slack.defaultChannel();
    if (channel && (action === "CLOSE" || action === "START" || action === "LINK")) {
      try {
        const ref = { key: ticket.key, title: ticket.title };
        const commitRef = {
          sha: commit.sha,
          message: commit.message,
          authorName: commit.authorName,
        };
        if (action === "CLOSE") await this.slack.postTicketClosed(channel, ref, commitRef, tenantId);
        else if (action === "START") await this.slack.postTicketStarted(channel, ref, commitRef, tenantId);
        else await this.slack.postTicketLinked(channel, ref, commitRef, tenantId);
        outcome.slackPosted = true;
      } catch (err) {
        this.logger.warn(`Slack post failed for ${key}: ${(err as Error).message}`);
        outcome.slackPosted = false;
      }
    }

    // Daily-update pre-fill — only on CLOSE, only when the commit author
    // is a member of this tenant (unknown authors get no invented member).
    if (action === "CLOSE") {
      outcome.dailyUpdatePrefilled = await this.prefillDailyUpdate(tenantId, ticket.id, commit);
    }
    return outcome;
  }

  private async moveToCategory(
    tenantId: string,
    ticket: { id: string; boardId: string | null; projectId: string },
    category: "TODO" | "IN_PROGRESS" | "DONE",
    commit: CommitInput,
    key: string,
  ): Promise<boolean> {
    const column = await this.prisma.boardColumn.findFirst({
      where: {
        tenantId,
        category,
        ...(ticket.boardId
          ? { boardId: ticket.boardId }
          : { board: { projectId: ticket.projectId } }),
      },
      orderBy: { order: "asc" },
    });
    if (!column) {
      this.logger.warn(`No ${category} column for ticket ${key} (commit ${commit.sha})`);
      return false;
    }
    await this.tickets.changeStatus(
      tenantId,
      ticket.id,
      column.id,
      undefined,
      `Commit ${commit.sha.slice(0, 7)}`,
    );
    return true;
  }

  /**
   * CALL SITE — daily-update pre-fill. Wires to the existing daily-updates
   * module via DailyUpdatesService.upsertToday (no edits to that module):
   * one update per member per ticket per day, progress 100% on close.
   * Returns false when the author cannot be resolved to a tenant member.
   */
  private async prefillDailyUpdate(
    tenantId: string,
    ticketId: string,
    commit: CommitInput,
  ): Promise<boolean> {
    if (!commit.authorEmail) return false;
    const membership = await this.prisma.membership.findFirst({
      where: { tenantId, user: { email: commit.authorEmail } },
      select: { userId: true },
    });
    if (!membership) {
      this.logger.log(
        `Commit author ${commit.authorEmail} is not a member of tenant ${tenantId} — no daily update pre-filled`,
      );
      return false;
    }
    await this.dailyUpdates.upsertToday(tenantId, membership.userId, ticketId, {
      doneToday: `Closed via commit ${commit.sha.slice(0, 7)}: ${commit.message.split("\n")[0]}`,
      progressPercent: 100,
      health: "ON_TRACK",
    });
    return true;
  }
}
