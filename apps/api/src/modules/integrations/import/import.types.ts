/**
 * Jira / ClickUp import — file-upload only for Phase 1 (docs/INTEGRATIONS.md).
 * No live Jira/ClickUp API calls: the workspace admin exports CSV/JSON
 * from Jira or ClickUp and uploads the file. Import is tenant-scoped and
 * idempotent by external id (see import.service.ts).
 */

export type ImportSource = "JIRA" | "CLICKUP";
export type ImportFormat = "CSV" | "JSON";

/** One project row from the export file. */
export interface ImportProjectRow {
  externalId?: string;
  key: string;
  name: string;
  description?: string;
}

/** One ticket/issue/task row from the export file. */
export interface ImportTicketRow {
  /** Stable id in the source system (Jira issue id / ClickUp task id). */
  externalId: string;
  /** Human key in the source system, e.g. ENG-123. */
  externalKey?: string;
  /** Project key this ticket belongs to (must match a project row). */
  projectKey: string;
  title: string;
  description?: string;
  type?: string;
  status: string;
  priority?: string;
  assigneeEmail?: string;
  assigneeName?: string;
  /** External id of the parent ticket (epic/story), if any. */
  parentExternalId?: string;
  dueDate?: string;
  labels?: string[];
}

export interface ImportUserRow {
  email: string;
  name?: string;
}

export interface ImportFileData {
  source: ImportSource;
  projects: ImportProjectRow[];
  tickets: ImportTicketRow[];
  users: ImportUserRow[];
}

export interface DryRunIssue {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

/** What a dry run reports — no rows are written. */
export interface DryRunReport {
  source: ImportSource;
  format: ImportFormat;
  projects: number;
  tickets: number;
  users: number;
  /** Status names found → reporting category they will map to. */
  statusMapping: Record<string, "TODO" | "IN_PROGRESS" | "DONE">;
  /** Source users with no matching member in this tenant (see below). */
  unmappedUsers: string[];
  errors: DryRunIssue[];
  warnings: DryRunIssue[];
  wouldCreate: { projects: number; tickets: number; columns: number };
}

/** What an import run reports. */
export interface ImportResult {
  source: ImportSource;
  createdProjects: number;
  existingProjects: number;
  createdTickets: number;
  skippedExistingTickets: number;
  linkedParents: number;
  columnsCreated: number;
  /**
   * Source users with no member in this tenant. They are NOT turned into
   * accounts or guests — there is no User row to guest with — so their
   * tickets are created unassigned and the assignee is kept in the
   * ticket's customFields.externalAssignee. The workspace admin invites
   * them afterwards; re-import is idempotent and will then assign them.
   */
  unmappedUsers: string[];
  errors: DryRunIssue[];
}
