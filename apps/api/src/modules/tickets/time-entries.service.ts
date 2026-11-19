import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** Marker for the entry a Daily Update writes (see syncFromDailyUpdate). */
export const DAILY_UPDATE_NOTE = "Daily update";

export interface CreateTimeEntryInput {
  minutes: number;
  date?: string;
  note?: string;
}

export interface TimeTotalsFilter {
  sprintId?: string;
  projectId?: string;
}

export interface TimeTotals {
  totalMinutes: number;
  totalHours: number;
  byMember: { memberId: string; memberName: string; minutes: number }[];
  byTicket: { ticketId: string; ticketTitle: string; minutes: number }[];
}

export interface SyncDailyUpdateTimeInput {
  memberId: string;
  date: Date;
  minutes?: number | null;
}

/**
 * Time tracking (FEATURE-EVALUATION #26): a lightweight time log,
 * summed per ticket. No invoicing — that is a billing feature.
 *
 * One source, not two: DailyUpdate.timeSpentMin writes here through
 * syncFromDailyUpdate (the DailyUpdatesService caller is a one-line
 * hook — see the Slice C report; this module must not import it).
 * The synced entry is the single entry for (ticket, member, day)
 * whose note is null or DAILY_UPDATE_NOTE; hand-logged entries (with
 * a real note) are never overwritten by the sync. A `source` column
 * on TimeEntry would make this robust — schema follow-up, not done
 * here (no schema changes in this slice).
 */
@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTicketInTenant(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException("Ticket not found in this tenant");
  }

  /**
   * Per-sprint / per-project totals — sums minutes grouped by member and
   * by ticket. No filter = whole workspace. A sprint/project filter that
   * does not belong to this tenant is a 404 (same tenant rule as list).
   */
  async totals(tenantId: string, filter: TimeTotalsFilter = {}): Promise<TimeTotals> {
    if (filter.sprintId) {
      const sprint = await this.prisma.sprint.findFirst({
        where: { id: filter.sprintId, tenantId },
      });
      if (!sprint) throw new NotFoundException("Sprint not found in this tenant");
    }
    if (filter.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: filter.projectId, tenantId },
      });
      if (!project) throw new NotFoundException("Project not found in this tenant");
    }
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        tenantId,
        ticket: {
          ...(filter.sprintId ? { sprintId: filter.sprintId } : {}),
          ...(filter.projectId ? { projectId: filter.projectId } : {}),
        },
      },
      include: {
        member: { select: { id: true, name: true } },
        ticket: { select: { id: true, title: true } },
      },
    });
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
    const byMemberMap = new Map<string, { memberId: string; memberName: string; minutes: number }>();
    const byTicketMap = new Map<string, { ticketId: string; ticketTitle: string; minutes: number }>();
    for (const e of entries) {
      const m = byMemberMap.get(e.memberId) ?? {
        memberId: e.memberId,
        memberName: e.member.name,
        minutes: 0,
      };
      m.minutes += e.minutes;
      byMemberMap.set(e.memberId, m);
      const t = byTicketMap.get(e.ticketId) ?? {
        ticketId: e.ticketId,
        ticketTitle: e.ticket.title,
        minutes: 0,
      };
      t.minutes += e.minutes;
      byTicketMap.set(e.ticketId, t);
    }
    const byMinutesDesc = (a: { minutes: number }, b: { minutes: number }) => b.minutes - a.minutes;
    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      byMember: [...byMemberMap.values()].sort(byMinutesDesc),
      byTicket: [...byTicketMap.values()].sort(byMinutesDesc),
    };
  }

  /** Parse a YYYY-MM-DD date (or default to today, UTC); never the future. */
  parseDate(input?: string): Date {
    const date = input ? new Date(`${input}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    date.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (date > today) {
      throw new BadRequestException("Time cannot be logged for a future date");
    }
    return date;
  }

  async list(tenantId: string, ticketId: string) {
    await this.assertTicketInTenant(tenantId, ticketId);
    const [entries, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { tenantId, ticketId },
        include: { member: { select: { id: true, name: true } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.timeEntry.aggregate({ where: { tenantId, ticketId }, _sum: { minutes: true } }),
    ]);
    return { entries, totalMinutes: total._sum.minutes ?? 0 };
  }

  async create(tenantId: string, ticketId: string, memberId: string, input: CreateTimeEntryInput) {
    await this.assertTicketInTenant(tenantId, ticketId);
    return this.prisma.timeEntry.create({
      data: {
        tenantId,
        ticketId,
        memberId,
        date: this.parseDate(input.date),
        minutes: input.minutes,
        note: input.note,
      },
    });
  }

  /** A member deletes only their own entry (scoped to tenant + ticket + member). */
  async remove(tenantId: string, ticketId: string, entryId: string, memberId: string) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: entryId, tenantId, ticketId, memberId },
    });
    if (!entry) {
      throw new NotFoundException("Time entry not found");
    }
    await this.prisma.timeEntry.delete({ where: { id: entryId } });
    return { id: entryId, deleted: true };
  }

  /**
   * DailyUpdate.timeSpentMin writes to TimeEntry. Called by
   * DailyUpdatesService.upsertToday after the upsert. minutes null/0
   * removes the synced entry for that day (the update was cleared).
   */
  async syncFromDailyUpdate(tenantId: string, ticketId: string, input: SyncDailyUpdateTimeInput) {
    const day = new Date(input.date);
    day.setUTCHours(0, 0, 0, 0);
    const existing = await this.prisma.timeEntry.findFirst({
      where: {
        tenantId,
        ticketId,
        memberId: input.memberId,
        date: day,
        OR: [{ note: null }, { note: DAILY_UPDATE_NOTE }],
      },
    });
    if (!input.minutes) {
      if (existing) await this.prisma.timeEntry.delete({ where: { id: existing.id } });
      return null;
    }
    if (existing) {
      return this.prisma.timeEntry.update({
        where: { id: existing.id },
        data: { minutes: input.minutes },
      });
    }
    return this.prisma.timeEntry.create({
      data: {
        tenantId,
        ticketId,
        memberId: input.memberId,
        date: day,
        minutes: input.minutes,
        note: DAILY_UPDATE_NOTE,
      },
    });
  }
}
