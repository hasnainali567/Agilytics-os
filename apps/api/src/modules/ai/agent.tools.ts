import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Read-only tools for the workspace agent. Every tool closes over the
 * request's tenantId — the agent can never read another tenant's data,
 * and no tool writes anything (no create/update/delete tools exist yet
 * by design; write actions arrive later behind explicit user approval).
 */
export function buildAgentTools(prisma: PrismaService, tenantId: string) {
  const ticketStatusCounts = tool(
    async () => {
      // Statuses are custom BoardColumns — group by column, report the
      // category (TODO / IN_PROGRESS / DONE) alongside the free-text name.
      const columns = await prisma.boardColumn.findMany({
        where: { tenantId },
        select: { id: true, name: true, category: true, boardId: true },
        orderBy: { order: "asc" },
      });
      const tickets = await prisma.ticket.findMany({
        where: { tenantId },
        select: { statusId: true },
      });
      const counts = new Map<string, number>();
      for (const t of tickets) {
        if (t.statusId) counts.set(t.statusId, (counts.get(t.statusId) ?? 0) + 1);
      }
      const unplaced = tickets.filter((t) => !t.statusId).length;
      return JSON.stringify([
        ...columns.map((c) => ({
          column: c.name,
          category: c.category,
          boardId: c.boardId,
          count: counts.get(c.id) ?? 0,
        })),
        ...(unplaced
          ? [{ column: "Unplaced", category: "TODO", boardId: null, count: unplaced }]
          : []),
      ]);
    },
    {
      name: "ticket_status_counts",
      description:
        "Count tickets in this workspace grouped by board column (name + reporting category). Takes no input.",
      schema: z.object({}),
    },
  );

  const listProjects = tool(
    async () => {
      const projects = await prisma.project.findMany({
        where: { tenantId },
        select: { id: true, name: true, status: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      });
      return JSON.stringify(projects);
    },
    {
      name: "list_projects",
      description: "List the workspace's projects (id, name, status). Takes no input.",
      schema: z.object({}),
    },
  );

  const sprintStatus = tool(
    async () => {
      const sprints = await prisma.sprint.findMany({
        where: { tenantId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          goal: true,
          startDate: true,
          endDate: true,
          projectId: true,
        },
        take: 5,
      });
      const out = [];
      for (const sprint of sprints) {
        const sprintTickets = await prisma.ticket.findMany({
          where: { tenantId, sprintId: sprint.id },
          select: { status: { select: { category: true } } },
        });
        const total = sprintTickets.length;
        const done = sprintTickets.filter((t) => t.status?.category === "DONE").length;
        out.push({ ...sprint, ticketsTotal: total, ticketsDone: done });
      }
      return JSON.stringify(out);
    },
    {
      name: "sprint_status",
      description:
        "Active sprints with goal, dates, and ticket progress (done/total). Takes no input.",
      schema: z.object({}),
    },
  );

  return [ticketStatusCounts, listProjects, sprintStatus];
}
