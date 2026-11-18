import { apiUrl } from "../../lib/query-client";
import type { DashboardLayoutData, RoleTemplate, SavedLayoutResponse } from "./types";

/** Typed client for GET/PUT /dashboard/layout and POST /dashboard/layout/reset. */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Dashboard layout API failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchDashboardLayout(template?: RoleTemplate): Promise<SavedLayoutResponse> {
  const query = template ? `?template=${template}` : "";
  return request<SavedLayoutResponse>(`/dashboard/layout${query}`);
}

export function saveDashboardLayout(
  layout: DashboardLayoutData,
  template?: RoleTemplate,
): Promise<SavedLayoutResponse> {
  return request<SavedLayoutResponse>("/dashboard/layout", {
    method: "PUT",
    body: JSON.stringify({ name: "default", layout, template }),
  });
}

export function resetDashboardLayout(template?: RoleTemplate): Promise<SavedLayoutResponse> {
  return request<SavedLayoutResponse>("/dashboard/layout/reset", {
    method: "POST",
    body: JSON.stringify({ name: "default", template }),
  });
}
