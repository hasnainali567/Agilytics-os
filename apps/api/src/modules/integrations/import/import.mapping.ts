import type {
  DryRunIssue,
  DryRunReport,
  ImportFileData,
  ImportFormat,
  ImportProjectRow,
  ImportSource,
  ImportTicketRow,
  ImportUserRow,
} from "./import.types";

export type ColumnCategory = "TODO" | "IN_PROGRESS" | "DONE";

/**
 * Status → reporting category. The column NAME is preserved verbatim
 * (custom workflows); only the category drives reporting. Matching is
 * case-insensitive, exact first, then substring fallback ("done" in the
 * name → DONE, "progress"/"review"/"testing" → IN_PROGRESS).
 * Unknown statuses default to TODO and are listed in the dry-run report.
 */
const EXACT: Record<string, ColumnCategory> = {
  // Jira defaults
  "to do": "TODO",
  "to-do": "TODO",
  open: "TODO",
  backlog: "TODO",
  new: "TODO",
  "in progress": "IN_PROGRESS",
  "in review": "IN_PROGRESS",
  "in development": "IN_PROGRESS",
  testing: "IN_PROGRESS",
  qa: "IN_PROGRESS",
  done: "DONE",
  closed: "DONE",
  resolved: "DONE",
  // ClickUp defaults
  complete: "DONE",
};

export function mapStatusToCategory(
  status: string,
  _source: ImportSource,
  customMapping?: Record<string, ColumnCategory>,
): ColumnCategory {
  const key = status.trim().toLowerCase();
  if (customMapping?.[status] ?? customMapping?.[key]) {
    return (customMapping[status] ?? customMapping[key]) as ColumnCategory;
  }
  if (EXACT[key]) return EXACT[key];
  if (/done|complete|closed|resolved|shipped|deployed/.test(key)) return "DONE";
  if (/progress|review|develop|test|qa|doing|working/.test(key)) return "IN_PROGRESS";
  return "TODO";
}

export function mapTicketType(type: string | undefined): "EPIC" | "STORY" | "TASK" | "BUG" {
  switch ((type ?? "").trim().toLowerCase()) {
    case "epic":
      return "EPIC";
    case "story":
      return "STORY";
    case "bug":
      return "BUG";
    case "subtask":
    case "sub-task":
    case "task":
    default:
      return "TASK";
  }
}

export function mapPriority(priority: string | undefined): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  switch ((priority ?? "").trim().toLowerCase()) {
    case "urgent":
    case "highest":
    case "critical":
      return "URGENT";
    case "high":
      return "HIGH";
    case "low":
    case "lowest":
      return "LOW";
    default:
      return "MEDIUM";
  }
}

/** Minimal CSV parser — quoted fields, escaped quotes, CRLF. No dependency. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse a Jira/ClickUp export. JSON accepts `{ projects, issues|tickets,
 * users }` (or a bare array of tickets). CSV accepts the usual Jira
 * export headers (Issue key, Summary, Status, Issue Type, Assignee,
 * Parent, Priority, Description) and ClickUp headers (Task Name, Status,
 * Assignee, List/Project …). Header names are case-insensitive.
 */
export function parseImportFile(
  content: string,
  format: ImportFormat,
  source: ImportSource,
): ImportFileData {
  if (format === "JSON") return parseJson(content, source);
  return parseCsvFile(content, source);
}

function parseJson(content: string, source: ImportSource): ImportFileData {
  let raw: unknown;
  try {
    raw = JSON.parse(content) as unknown;
  } catch {
    throw new Error("Import file is not valid JSON");
  }
  const obj = (Array.isArray(raw) ? { tickets: raw } : raw) as Record<string, unknown>;
  const projects = ((obj.projects as unknown[]) ?? []).map((p) => {
    const r = p as Record<string, unknown>;
    return {
      externalId: r.id != null ? String(r.id) : undefined,
      key: String(r.key ?? ""),
      name: String(r.name ?? ""),
      description: r.description != null ? String(r.description) : undefined,
    } satisfies ImportProjectRow;
  });
  const rawTickets = ((obj.issues as unknown[]) ??
    (obj.tickets as unknown[]) ??
    (obj.tasks as unknown[]) ??
    []) as Record<string, unknown>[];
  const tickets = rawTickets.map((t) => toTicketRow(t));
  const users = ((obj.users as unknown[]) ?? []).map((u) => {
    const r = u as Record<string, unknown>;
    return {
      email: String(r.email ?? ""),
      name: r.name != null ? String(r.name) : undefined,
    } satisfies ImportUserRow;
  });
  return { source, projects, tickets, users };
}

function toTicketRow(t: Record<string, unknown>): ImportTicketRow {
  const assignee = t.assignee as Record<string, unknown> | string | null | undefined;
  const assigneeObj = assignee && typeof assignee === "object" ? assignee : undefined;
  return {
    externalId: String(t.id ?? t.key ?? ""),
    externalKey: t.key != null ? String(t.key) : undefined,
    projectKey: String(t.projectKey ?? t.project ?? ""),
    title: String(t.summary ?? t.title ?? t.name ?? ""),
    description: t.description != null ? String(t.description) : undefined,
    type: t.type != null ? String(t.type) : undefined,
    status: String(t.status ?? ""),
    priority: t.priority != null ? String(t.priority) : undefined,
    assigneeEmail: assigneeObj
      ? assigneeObj.email != null
        ? String(assigneeObj.email)
        : undefined
      : typeof assignee === "string"
        ? assignee
        : undefined,
    assigneeName: assigneeObj && assigneeObj.name != null ? String(assigneeObj.name) : undefined,
    parentExternalId:
      t.parentId != null ? String(t.parentId) : t.parent != null ? String(t.parent) : undefined,
    dueDate: t.dueDate != null ? String(t.dueDate) : undefined,
    labels: Array.isArray(t.labels) ? t.labels.map(String) : undefined,
  };
}

function parseCsvFile(content: string, source: ImportSource): ImportFileData {
  const rows = parseCsv(content);
  if (rows.length < 2) throw new Error("Import CSV needs a header row and at least one data row");
  const headers = rows[0];
  const get = (row: string[], ...names: string[]) => {
    const idx = headerIndex(headers, ...names);
    return idx >= 0 ? row[idx]?.trim() : undefined;
  };
  const projects = new Map<string, ImportProjectRow>();
  const tickets: ImportTicketRow[] = [];
  const users = new Map<string, ImportUserRow>();
  for (const row of rows.slice(1)) {
    const key = get(row, "issue key", "key", "task id") ?? "";
    const projectKey = key.includes("-")
      ? key.split("-")[0].toUpperCase()
      : (get(row, "project", "project key", "list") ?? "");
    if (projectKey && !projects.has(projectKey)) {
      projects.set(projectKey, { key: projectKey, name: projectKey });
    }
    const assignee = get(row, "assignee", "assignee email");
    if (assignee?.includes("@")) users.set(assignee, { email: assignee });
    tickets.push({
      externalId: key || `row-${tickets.length + 1}`,
      externalKey: key || undefined,
      projectKey,
      title: get(row, "summary", "task name", "title", "name") ?? "",
      description: get(row, "description"),
      type: get(row, "issue type", "type"),
      status: get(row, "status") ?? "",
      priority: get(row, "priority"),
      assigneeEmail: assignee?.includes("@") ? assignee : undefined,
      assigneeName: assignee && !assignee.includes("@") ? assignee : undefined,
      parentExternalId: get(row, "parent", "parent id", "parent key"),
      dueDate: get(row, "due date", "dueDate"),
      labels: get(row, "labels")?.split(/\s+/).filter(Boolean),
    });
  }
  return { source, projects: [...projects.values()], tickets, users: [...users.values()] };
}

/** Dry-run validation — errors block those rows, warnings do not. */
export function validateImport(data: ImportFileData): DryRunIssue[] {
  const issues: DryRunIssue[] = [];
  const projectKeys = new Set(data.projects.map((p) => p.key.toUpperCase()));
  data.projects.forEach((p, i) => {
    if (!p.key.trim())
      issues.push({ row: i, field: "key", message: "Project has no key", severity: "error" });
    if (!/^[A-Z][A-Z0-9]+$/.test(p.key.trim().toUpperCase())) {
      issues.push({
        row: i,
        field: "key",
        message: `Project key "${p.key}" is not a valid key (letters/digits, starts with a letter)`,
        severity: "error",
      });
    }
    if (!p.name.trim())
      issues.push({ row: i, field: "name", message: "Project has no name", severity: "warning" });
  });
  const seenExternal = new Set<string>();
  const ticketKeys = new Set(data.tickets.map((t) => t.externalId));
  data.tickets.forEach((t, i) => {
    if (!t.externalId.trim())
      issues.push({
        row: i,
        field: "externalId",
        message: "Ticket has no id/key",
        severity: "error",
      });
    if (seenExternal.has(t.externalId)) {
      issues.push({
        row: i,
        field: "externalId",
        message: `Duplicate ticket id "${t.externalId}"`,
        severity: "error",
      });
    }
    seenExternal.add(t.externalId);
    if (!t.title.trim())
      issues.push({ row: i, field: "title", message: "Ticket has no title", severity: "error" });
    if (!t.status.trim())
      issues.push({ row: i, field: "status", message: "Ticket has no status", severity: "error" });
    if (!t.projectKey.trim() || !projectKeys.has(t.projectKey.toUpperCase())) {
      issues.push({
        row: i,
        field: "projectKey",
        message: `Ticket "${t.externalId}" names unknown project "${t.projectKey}"`,
        severity: "error",
      });
    }
    if (t.parentExternalId && !ticketKeys.has(t.parentExternalId)) {
      issues.push({
        row: i,
        field: "parentExternalId",
        message: `Parent "${t.parentExternalId}" is not in this file`,
        severity: "warning",
      });
    }
    if (t.dueDate && Number.isNaN(Date.parse(t.dueDate))) {
      issues.push({
        row: i,
        field: "dueDate",
        message: `Due date "${t.dueDate}" is not a date`,
        severity: "warning",
      });
    }
  });
  data.users.forEach((u, i) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) {
      issues.push({
        row: i,
        field: "email",
        message: `User email "${u.email}" is not valid`,
        severity: "warning",
      });
    }
  });
  return issues;
}

export function buildDryRunReport(
  data: ImportFileData,
  format: ImportFormat,
  customMapping?: Record<string, ColumnCategory>,
): DryRunReport {
  const issues = validateImport(data);
  const statusMapping: Record<string, ColumnCategory> = {};
  for (const t of data.tickets) {
    if (t.status.trim())
      statusMapping[t.status] = mapStatusToCategory(t.status, data.source, customMapping);
  }
  const columns = new Set(data.tickets.map((t) => `${t.projectKey}:${t.status}`)).size;
  return {
    source: data.source,
    format,
    projects: data.projects.length,
    tickets: data.tickets.length,
    users: data.users.length,
    statusMapping,
    unmappedUsers: [...new Set(data.users.map((u) => u.email))],
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
    wouldCreate: { projects: data.projects.length, tickets: data.tickets.length, columns },
  };
}
