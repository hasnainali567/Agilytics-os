import { Injectable } from "@nestjs/common";
import type { DashboardSummary, Member, TodayFeed, VelocityPoint } from "@agilytics/shared";
import { PrismaService } from "../../prisma/prisma.service";

/** A ticket counts as stale when it is not done and nobody updated it in 3 days. */
const STALE_AFTER_DAYS = 3;

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardSummary(tenantId: string): Promise<DashboardSummary> {
    const [activeProjects, tickets, memberships] = await Promise.all([
      this.prisma.project.count({ where: { tenantId, status: "ACTIVE" } }),
      // Statuses are custom BoardColumns — "done" is a category, never a name.
      this.prisma.ticket.findMany({ where: { tenantId }, include: { status: true } }),
      this.prisma.membership.findMany({
        where: { tenantId },
        include: { user: true },
      }),
    ]);

    const isDone = (t: { status?: { category: string } | null }) => t.status?.category === "DONE";
    const doneTickets = tickets.filter(isDone);
    // Overdue counts in JS on purpose: a relation filter would drop
    // tickets with no status yet (unplaced), which are overdue too.
    const now = new Date();
    const overdueTickets = tickets.filter((t) => !isDone(t) && t.dueDate && t.dueDate < now).length;
    const velocityPoints = doneTickets.reduce((sum, t) => sum + (t.estimate ?? 0), 0);
    const members = this.buildMembers(tenantId, memberships, tickets, isDone);
    const velocity = await this.buildVelocity(tenantId);
    const today = await this.buildTodayFeed(tenantId, memberships, tickets, isDone);

    return {
      kpis: {
        activeProjects,
        activeProjectsDelta: 0,
        ticketsDoneThisSprint: doneTickets.length,
        ticketsDoneDelta: 0,
        velocityPoints,
        velocityDelta: 0,
        atRiskMembers: members.filter((m) => m.status !== "ACTIVE").length,
        overdueTickets,
      },
      velocity,
      members,
      today,
    };
  }

  private buildMembers(
    tenantId: string,
    memberships: { userId: string; role: string; user: { name: string; email: string } }[],
    tickets: {
      assigneeId?: string | null;
      estimate?: number | null;
      status?: { category: string } | null;
    }[],
    isDone: (t: { status?: { category: string } | null }) => boolean,
  ): Member[] {
    return memberships.map((m, i) => {
      const mine = tickets.filter((t) => t.assigneeId === m.userId);
      const active = mine.filter((t) => !isDone(t)).length;
      const points = mine.filter(isDone).reduce((sum, t) => sum + (t.estimate ?? 0), 0);
      const status = active > 8 ? "OVERLOADED" : points < 10 && active > 5 ? "AT_RISK" : "ACTIVE";
      return {
        id: `m-${i}`,
        tenantId,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role as Member["role"],
        activeTickets: active,
        completedPoints: points,
        status,
      };
    });
  }

  private async buildVelocity(tenantId: string): Promise<VelocityPoint[]> {
    // Velocity is measured when a ticket ENTERS a DONE-category column.
    const history = await this.prisma.ticketStatusHistory.findMany({
      where: { tenantId, toStatus: { category: "DONE" } },
      orderBy: { createdAt: "asc" },
      include: { ticket: true },
    });
    const weeks = new Map<string, { completed: number; planned: number }>();
    for (const h of history) {
      const week = h.createdAt.toISOString().slice(0, 10);
      const entry = weeks.get(week) ?? { completed: 0, planned: 0 };
      entry.completed += h.ticket.estimate ?? 0;
      entry.planned += h.ticket.estimate ?? 0;
      weeks.set(week, entry);
    }
    return [...weeks.entries()].slice(-6).map(([week, v]) => ({ week, ...v }));
  }

  /**
   * Today feed + stale tickets — derived from daily updates + status
   * history, never from comments. "Silent" means no daily update today.
   */
  private async buildTodayFeed(
    tenantId: string,
    memberships: { userId: string; user: { name: string } }[],
    tickets: { id: string; title: string; status?: { category: string } | null }[],
    isDone: (t: { status?: { category: string } | null }) => boolean,
  ): Promise<TodayFeed> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [updatesToday, recentUpdates] = await Promise.all([
      this.prisma.dailyUpdate.findMany({
        where: { tenantId, date: today },
        select: { memberId: true, hasBlocker: true },
      }),
      this.prisma.dailyUpdate.findMany({
        where: { tenantId },
        select: { ticketId: true, date: true },
        orderBy: { date: "desc" },
      }),
    ]);
    const updatedIds = new Set(updatesToday.map((u) => u.memberId));
    const byMember = new Map(memberships.map((m) => [m.userId, m.user.name]));
    const updatedNames = [...updatedIds].map((id) => byMember.get(id) ?? id).slice(0, 10);
    const silentNames = memberships
      .filter((m) => !updatedIds.has(m.userId))
      .map((m) => m.user.name)
      .slice(0, 10);
    const lastUpdate = new Map<string, Date>();
    for (const u of recentUpdates) {
      if (!lastUpdate.has(u.ticketId)) lastUpdate.set(u.ticketId, u.date);
    }
    const staleCutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const staleTickets = tickets
      .filter((t) => !isDone(t))
      .map((t) => {
        const last = lastUpdate.get(t.id);
        const daysStale = last
          ? Math.floor((Date.now() - last.getTime()) / (24 * 60 * 60 * 1000))
          : STALE_AFTER_DAYS;
        return {
          id: t.id,
          title: t.title,
          daysStale,
          stale: !last || last.getTime() < staleCutoff,
        };
      })
      .filter((t) => t.stale)
      .map(({ id, title, daysStale }) => ({ id, title, daysStale }))
      .slice(0, 10);
    return {
      date: today.toISOString().slice(0, 10),
      updatedMembers: updatedIds.size,
      totalMembers: memberships.length,
      updatedNames,
      silentNames,
      openBlockers: updatesToday.filter((u) => u.hasBlocker).length,
      staleTickets,
    };
  }
}
