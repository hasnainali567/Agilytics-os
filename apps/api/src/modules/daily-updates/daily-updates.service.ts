import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TimeEntriesService } from "../tickets/time-entries.service";

export interface DailyUpdateInput {
  doneToday: string;
  next?: string;
  blockers?: string;
  hasBlocker?: boolean;
  progressPercent?: number;
  health?: "ON_TRACK" | "AT_RISK" | "BLOCKED";
  timeSpentMin?: number;
}

/**
 * Daily updates — one per member per ticket per day. This is the record
 * that shows a task's current state and tracks a person; comments alone
 * cannot do either. The Today feed, stale-ticket detection, blocker
 * lists and progress trends all read from here + status history.
 */
@Injectable()
export class DailyUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeEntries: TimeEntriesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Start of today (UTC) — the day bucket for the one-per-day upsert. */
  private today(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /** Create or update today's update for this member on this ticket. */
  async upsertToday(tenantId: string, memberId: string, ticketId: string, data: DailyUpdateInput) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new Error("Ticket not found in this tenant");
    const date = this.today();
    const update = await this.prisma.dailyUpdate.upsert({
      where: { ticketId_memberId_date: { ticketId, memberId, date } },
      update: { ...data, hasBlocker: data.hasBlocker ?? false },
      create: { tenantId, ticketId, memberId, date, ...data, hasBlocker: data.hasBlocker ?? false },
    });
    // One source for time: DailyUpdate.timeSpentMin writes to TimeEntry.
    // Best-effort — a time-sync failure must never fail the daily update.
    if (data.timeSpentMin != null) {
      await Promise.resolve(
        this.timeEntries.syncFromDailyUpdate(tenantId, ticketId, {
          memberId,
          date,
          minutes: data.timeSpentMin,
        }),
      ).catch(() => null);
    }
    if (data.hasBlocker) {
      await Promise.resolve(
        this.notifications.notifyBlocker(tenantId, [memberId], ticket, data.blockers),
      ).catch(() => null);
    }
    return update;
  }

  /** Timeline of updates on one ticket, newest first. */
  timeline(tenantId: string, ticketId: string) {
    return this.prisma.dailyUpdate.findMany({
      where: { tenantId, ticketId },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });
  }

  /** Who updated today, who did not, and today's open blockers. */
  async todayFeed(tenantId: string) {
    const date = this.today();
    const [memberships, updates] = await Promise.all([
      this.prisma.membership.findMany({
        where: { tenantId },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.dailyUpdate.findMany({
        where: { tenantId, date },
        include: {
          member: { select: { id: true, name: true } },
          ticket: { select: { id: true, title: true, projectId: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const updatedIds = new Set(updates.map((u) => u.memberId));
    return {
      date: date.toISOString().slice(0, 10),
      updated: updates.map((u) => ({
        memberId: u.memberId,
        memberName: u.member.name,
        ticketId: u.ticket.id,
        ticketTitle: u.ticket.title,
        doneToday: u.doneToday,
        health: u.health,
        hasBlocker: u.hasBlocker,
      })),
      silent: memberships
        .filter((m) => !updatedIds.has(m.userId))
        .map((m) => ({ memberId: m.userId, memberName: m.user.name })),
      openBlockers: updates
        .filter((u) => u.hasBlocker)
        .map((u) => ({
          ticketId: u.ticket.id,
          ticketTitle: u.ticket.title,
          memberName: u.member.name,
          blockers: u.blockers,
        })),
    };
  }

  /**
   * Open blockers across a project (or the whole workspace): the latest
   * blocker-flagged update per ticket, newest first.
   */
  async blockers(tenantId: string, projectId?: string) {
    const updates = await this.prisma.dailyUpdate.findMany({
      where: {
        tenantId,
        hasBlocker: true,
        ...(projectId ? { ticket: { projectId } } : {}),
      },
      include: {
        member: { select: { id: true, name: true } },
        ticket: { select: { id: true, title: true, projectId: true } },
      },
      orderBy: { date: "desc" },
    });
    const seen = new Set<string>();
    return updates
      .filter((u) => {
        if (seen.has(u.ticketId)) return false;
        seen.add(u.ticketId);
        return true;
      })
      .map((u) => ({
        ticketId: u.ticket.id,
        ticketTitle: u.ticket.title,
        projectId: u.ticket.projectId,
        memberName: u.member.name,
        blockers: u.blockers,
        date: u.date.toISOString().slice(0, 10),
        health: u.health,
      }));
  }
}
