import type {
  Board,
  BoardColumn,
  DashboardSummary,
  Project,
  Sprint,
  Ticket,
  TicketPriority,
} from "@agilytics/shared";
import { apiUrl } from "./query-client";
import { apiFetch } from "./authFetch";

/** Thin API client — the web app holds no business rules and no mock data.
 *  Pages render loading / empty / error states when the API is down. */

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `API request failed: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (typeof body.message === "string") detail = body.message;
      else if (Array.isArray(body.message)) detail = body.message.join(", ");
    } catch {
      // Keep the status-based message.
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiFetch(`${apiUrl}/reporting/dashboard-summary`);
  if (!res.ok) {
    throw new Error(`Dashboard API failed: ${res.status}`);
  }
  return (await res.json()) as DashboardSummary;
}

export async function fetchAdminOrganisations(): Promise<
  { id: string; name: string; slug: string; members: number; projects: number }[]
> {
  // GET /admin/organisations returns Prisma rows with _count — map them to
  // the flat counts the Admin page renders.
  const rows = await apiJson<
    {
      id: string;
      name: string;
      slug: string;
      _count: { memberships: number; projects: number };
    }[]
  >("/admin/organisations");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    members: r._count.memberships,
    projects: r._count.projects,
  }));
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  memberships: { organisation: { id: string; name: string } }[];
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return apiJson<AdminUser[]>("/admin/users");
}

export interface AdminAuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
}

export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  return apiJson<AdminAuditLog[]>("/admin/audit-logs");
}

export interface AdminHealth {
  status: string;
  service: string;
  time: string;
}

export async function fetchAdminHealth(): Promise<AdminHealth> {
  return apiJson<AdminHealth>("/admin/health");
}

export type BoardWithColumns = Board & { columns: BoardColumn[] };

export async function fetchBoards(projectId?: string): Promise<BoardWithColumns[]> {
  const res = await apiFetch(`${apiUrl}/boards${projectId ? `?projectId=${projectId}` : ""}`);
  if (!res.ok) {
    throw new Error(`Boards API failed: ${res.status}`);
  }
  return (await res.json()) as BoardWithColumns[];
}

export async function moveTicketToColumn(ticketId: string, statusId: string): Promise<void> {
  const res = await apiFetch(`${apiUrl}/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statusId }),
  });
  if (!res.ok) {
    throw new Error(`Move ticket failed: ${res.status}`);
  }
}

export interface TodayFeedEntry {
  date: string;
  updated: { memberId: string; memberName: string; ticketTitle: string; doneToday: string }[];
  silent: { memberId: string; memberName: string }[];
  openBlockers: {
    ticketId: string;
    ticketTitle: string;
    memberName: string;
    blockers: string | null;
  }[];
}

export async function fetchTodayFeed(): Promise<TodayFeedEntry> {
  const res = await apiFetch(`${apiUrl}/daily-updates/today`);
  if (!res.ok) {
    throw new Error(`Today feed API failed: ${res.status}`);
  }
  return (await res.json()) as TodayFeedEntry;
}

export async function postDailyUpdate(
  ticketId: string,
  data: {
    doneToday: string;
    next?: string;
    blockers?: string;
    hasBlocker?: boolean;
    progressPercent?: number;
    health?: "ON_TRACK" | "AT_RISK" | "BLOCKED";
    timeSpentMin?: number;
  },
): Promise<void> {
  const res = await apiFetch(`${apiUrl}/tickets/${ticketId}/daily-updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Daily update failed: ${res.status}`);
  }
}

// --- Projects ---

/** A project as the API returns it — the shared Project type plus the
 *  human key (ENG, MA…) the API generates on create. */
export interface ProjectWithKey extends Project {
  key: string;
}

export async function fetchProjects(): Promise<ProjectWithKey[]> {
  return apiJson<ProjectWithKey[]>("/projects");
}

export async function createProject(data: {
  name: string;
  description?: string;
}): Promise<ProjectWithKey> {
  return apiJson<ProjectWithKey>("/projects", { method: "POST", body: JSON.stringify(data) });
}

// --- Sprints ---

export async function fetchSprints(): Promise<Sprint[]> {
  return apiJson<Sprint[]>("/sprints");
}

export interface CreateSprintInput {
  projectId: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
}

export async function createSprint(data: CreateSprintInput): Promise<Sprint> {
  return apiJson<Sprint>("/sprints", { method: "POST", body: JSON.stringify(data) });
}

// --- Tickets ---

/** A ticket as the list endpoint returns it: shared Ticket fields plus
 *  the human key (ENG-123) and the resolved status column. */
export interface TicketWithStatus extends Ticket {
  key: string;
  status: BoardColumn | null;
}

export async function fetchTickets(projectId?: string): Promise<TicketWithStatus[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiJson<TicketWithStatus[]>(`/tickets${qs}`);
}

export interface CreateTicketInput {
  projectId: string;
  boardId?: string;
  statusId?: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
  estimate?: number;
  assigneeId?: string;
  dueDate?: string;
}

export async function createTicket(data: CreateTicketInput): Promise<TicketWithStatus> {
  return apiJson<TicketWithStatus>("/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Members (via /identity/me) ---

export interface MemberDirectoryEntry {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  /** Workspace role (OWNER / ADMIN / LEAD / MEMBER / VIEWER). */
  role: string;
}

interface IdentityMeResponse {
  tenantId: string;
  memberships: {
    id: string;
    userId: string;
    role: string;
    roleId: string | null;
    user: { id: string; name: string; email: string };
  }[];
  me: {
    userId: string | null;
    roleId: string | null;
    roleName: string | null;
    permissions: string[];
  };
}

export async function fetchMembers(): Promise<MemberDirectoryEntry[]> {
  const data = await apiJson<IdentityMeResponse>("/identity/me");
  return data.memberships.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}

// --- Time entries ---

export interface TimeEntry {
  id: string;
  ticketId: string;
  memberId: string;
  date: string;
  minutes: number;
  note?: string | null;
  member?: { id: string; name: string };
}

export interface TimeTotals {
  totalMinutes: number;
  totalHours: number;
  byMember: { memberId: string; memberName: string; minutes: number }[];
  byTicket: { ticketId: string; ticketTitle: string; minutes: number }[];
}

export async function fetchTimeEntries(ticketId: string): Promise<{
  entries: TimeEntry[];
  totalMinutes: number;
}> {
  return apiJson<{ entries: TimeEntry[]; totalMinutes: number }>(
    `/tickets/${ticketId}/time-entries`,
  );
}

export async function createTimeEntry(
  ticketId: string,
  data: { minutes: number; date?: string; note?: string },
): Promise<TimeEntry> {
  return apiJson<TimeEntry>(`/tickets/${ticketId}/time-entries`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteTimeEntry(ticketId: string, entryId: string): Promise<void> {
  await apiJson(`/tickets/${ticketId}/time-entries/${entryId}`, { method: "DELETE" });
}

/** Per-sprint / per-project / workspace-wide time report (GET /reporting/time). */
export async function fetchTimeReport(filter?: {
  sprintId?: string;
  projectId?: string;
}): Promise<TimeTotals> {
  const qs = new URLSearchParams();
  if (filter?.sprintId) qs.set("sprintId", filter.sprintId);
  if (filter?.projectId) qs.set("projectId", filter.projectId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiJson<TimeTotals>(`/reporting/time${suffix}`);
}

export async function createBoard(data: {
  projectId: string;
  name: string;
  description?: string;
}): Promise<BoardWithColumns> {
  return apiJson<BoardWithColumns>("/boards", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function addBoardColumn(
  boardId: string,
  data: { name: string; category: "TODO" | "IN_PROGRESS" | "DONE"; colour?: string },
): Promise<BoardColumn> {
  return apiJson<BoardColumn>(`/boards/${boardId}/columns`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBoardColumn(
  boardId: string,
  columnId: string,
  data: { name?: string; category?: "TODO" | "IN_PROGRESS" | "DONE"; colour?: string },
): Promise<BoardColumn> {
  return apiJson<BoardColumn>(`/boards/${boardId}/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// --- Automations (Phase 2, trigger → action) ---

export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  trigger: string;
  action: string;
  /** Rule config JSON: channel/template for slack.post, url for webhook.post, … */
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationRuleInput {
  name: string;
  trigger: string;
  action: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export async function fetchAutomations(): Promise<AutomationRule[]> {
  return apiJson<AutomationRule[]>("/integrations/automations");
}

export async function createAutomation(data: CreateAutomationRuleInput): Promise<AutomationRule> {
  return apiJson<AutomationRule>("/integrations/automations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAutomation(
  id: string,
  data: Partial<CreateAutomationRuleInput>,
): Promise<AutomationRule> {
  return apiJson<AutomationRule>(`/integrations/automations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAutomation(id: string): Promise<void> {
  await apiJson(`/integrations/automations/${id}`, { method: "DELETE" });
}

export async function toggleAutomation(id: string): Promise<AutomationRule> {
  return apiJson<AutomationRule>(`/integrations/automations/${id}/toggle`, { method: "POST" });
}

export interface AutomationSweepResult {
  staleTickets: number;
  evaluated: number;
  outcomes: { ruleId: string; ruleName: string; action: string; ok: boolean; result: string }[];
}

export async function runAutomationSweep(): Promise<AutomationSweepResult> {
  return apiJson<AutomationSweepResult>("/integrations/automations/sweep", { method: "POST" });
}
