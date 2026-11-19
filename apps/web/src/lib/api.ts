import type { Board, BoardColumn, DashboardSummary } from "@agilytics/shared";
import { apiUrl } from "./query-client";
import { apiFetch } from "./authFetch";

/** Thin API client — the web app holds no business rules and no mock data.
 *  Pages render loading / empty / error states when the API is down. */
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
  const res = await apiFetch(`${apiUrl}/admin/organisations`);
  if (!res.ok) {
    throw new Error(`Admin API failed: ${res.status}`);
  }
  return (await res.json()) as never;
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
