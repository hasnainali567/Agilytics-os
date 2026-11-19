import { useEffect, useState } from "react";
import { Link2, MessageSquare, Github, FileText, Calendar, Upload, Zap } from "lucide-react";
import { TopBar } from "../components/layout";
import { Card, CardHeader, Field, Input, Select, Textarea } from "../components/ui";
import { apiUrl } from "../lib/query-client";
import { apiFetch } from "../lib/authFetch";
import {
  createAutomation,
  deleteAutomation,
  fetchAutomations,
  runAutomationSweep,
  toggleAutomation,
  updateAutomation,
  type AutomationRule,
  type AutomationSweepResult,
} from "../lib/api";
import {
  AUTOMATION_ACTION_CATALOG,
  AUTOMATION_TRIGGER_CATALOG,
} from "@agilytics/shared";

/** Connections hub — Tier 1/2/3 catalog from docs/INTEGRATIONS.md.
 *  Toggles are local until the Integrations API lands; connecting for real
 *  (OAuth) is the next slice. The Slack test post, GitHub PR list and
 *  Jira/ClickUp import below call the real Phase 1 API — no mock data:
 *  empty states stay empty until a repo is entered or a file uploaded. */

const btnPrimary =
  "rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnSecondary =
  "rounded-full border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50";

interface PullRequest {
  id: number;
  number: number;
  title: string;
  url: string;
  state: string;
  headRef: string;
}

interface DryRunReport {
  projects: number;
  tickets: number;
  users: number;
  statusMapping: Record<string, string>;
  unmappedUsers: string[];
  errors: { row: number; field: string; message: string; severity: string }[];
  warnings: { row: number; field: string; message: string; severity: string }[];
  wouldCreate: { projects: number; tickets: number; columns: number };
}

interface ImportResult {
  createdProjects: number;
  existingProjects: number;
  createdTickets: number;
  skippedExistingTickets: number;
  linkedParents: number;
  columnsCreated: number;
  unmappedUsers: string[];
  errors: { row: number; field: string; message: string }[];
}

async function postJson(path: string, body: unknown) {
  const res = await apiFetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as unknown;
}

function SlackCard() {
  const [channel, setChannel] = useState("#agilytics");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader
        title="Slack — thin slice"
        subtitle="Post a message to a channel. Needs SLACK_BOT_TOKEN on the API (Phase 1 placeholder; live OAuth stores a per-workspace token instead)."
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="w-36"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="#agilytics"
            aria-label="Slack channel"
          />
          <Input
            className="min-w-64 flex-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message to post…"
            aria-label="Message text"
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !channel.trim() || !text.trim()}
            onClick={async () => {
              setBusy(true);
              setStatus(null);
              try {
                await postJson("/integrations/slack/post", { channel, text });
                setStatus("Posted.");
                setText("");
              } catch (err) {
                setStatus(
                  `Could not post: ${(err as Error).message}. Is Slack configured on the API?`,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Posting…" : "Post to Slack"}
          </button>
        </div>
        {status ? <p className="text-xs text-muted">{status}</p> : null}
        <p className="text-xs text-muted">
          Automation also posts here: a commit that closes a ticket notifies this channel and
          pre-fills the author&apos;s daily update.
        </p>
      </div>
    </Card>
  );
}

function GitHubCard() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [ticketKey, setTicketKey] = useState("");
  const [prs, setPrs] = useState<PullRequest[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader
        title="GitHub — linked pull requests"
        subtitle="Open PRs for a repo. Filter by ticket key to see the PR list the ticket view shows for that ticket."
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="w-40"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner"
            aria-label="Repo owner"
          />
          <Input
            className="w-40"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="Repository"
            aria-label="Repository"
          />
          <Input
            className="w-52"
            value={ticketKey}
            onChange={(e) => setTicketKey(e.target.value)}
            placeholder="Ticket key, e.g. ENG-123"
            aria-label="Ticket key filter"
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !owner.trim() || !repo.trim()}
            onClick={async () => {
              setBusy(true);
              setStatus(null);
              try {
                const qs = new URLSearchParams({
                  owner,
                  repo,
                  ...(ticketKey.trim() ? { ticketKey: ticketKey.trim() } : {}),
                });
                const res = await apiFetch(`${apiUrl}/integrations/github/pull-requests?${qs}`);
                if (!res.ok) throw new Error(`Request failed: ${res.status}`);
                setPrs((await res.json()) as PullRequest[]);
              } catch (err) {
                setStatus(`Could not load PRs: ${(err as Error).message}`);
                setPrs(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Loading…" : "Load PRs"}
          </button>
        </div>
        {status ? <p className="text-xs text-muted">{status}</p> : null}
        {prs === null ? (
          <p className="text-xs text-muted">
            No repo loaded yet — enter an owner and repository above.
          </p>
        ) : prs.length === 0 ? (
          <p className="text-xs text-muted">
            No open PRs{ticketKey.trim() ? ` referencing ${ticketKey.trim()}` : ""} in this repo.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {prs.map((pr) => (
              <li key={pr.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium text-ink">
                    #{pr.number} {pr.title}
                  </p>
                  <p className="text-xs text-muted">
                    {pr.headRef} · {pr.state}
                  </p>
                </div>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-forest hover:underline"
                >
                  Open PR
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          Commit rule: <code>Fixes ENG-123</code> closes the ticket, <code>Starts ENG-123</code>{" "}
          moves it to in-progress, a bare key only links the commit. Merged PRs close their tickets
          the same way. See linked PRs on a ticket from the{" "}
          <a href="/sprints" className="font-medium text-forest hover:underline">
            board
          </a>
          .
        </p>
      </div>
    </Card>
  );
}

function ImportCard() {
  const [source, setSource] = useState<"JIRA" | "CLICKUP">("JIRA");
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const format: "CSV" | "JSON" = file?.name.toLowerCase().endsWith(".csv") ? "CSV" : "JSON";

  return (
    <Card>
      <CardHeader
        title="Import from Jira / ClickUp"
        subtitle="Upload a CSV or JSON export. Dry-run first to check the mapping, then import. Re-imports are idempotent — already-imported tickets are skipped."
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-36"
            value={source}
            onChange={(e) => setSource(e.target.value as "JIRA" | "CLICKUP")}
            aria-label="Import source"
          >
            <option value="JIRA">Jira</option>
            <option value="CLICKUP">ClickUp</option>
          </Select>
          <label className={`${btnSecondary} cursor-pointer`}>
            <Upload className="mr-2 inline h-4 w-4" />
            {file ? file.name : "Choose export file (.csv / .json)"}
            <input
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setReport(null);
                setResult(null);
                setStatus(null);
                if (f) setContent(await f.text());
              }}
            />
          </label>
          <button
            type="button"
            className={btnSecondary}
            disabled={busy || !content}
            onClick={async () => {
              setBusy(true);
              setStatus(null);
              try {
                setReport(
                  (await postJson("/integrations/import/dry-run", {
                    source,
                    format,
                    content,
                  })) as DryRunReport,
                );
              } catch (err) {
                setStatus(`Dry run failed: ${(err as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            Dry run
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !content || (report !== null && report.errors.length > 0)}
            onClick={async () => {
              setBusy(true);
              setStatus(null);
              try {
                setResult(
                  (await postJson("/integrations/import", {
                    source,
                    format,
                    content,
                  })) as ImportResult,
                );
              } catch (err) {
                setStatus(`Import failed: ${(err as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : "Import"}
          </button>
        </div>
        {status ? <p className="text-xs text-muted">{status}</p> : null}
        {report ? (
          <div className="space-y-2 rounded-lg border border-line bg-canvas p-3 text-xs text-ink">
            <p className="font-medium">
              Dry run: {report.projects} project(s), {report.tickets} ticket(s), {report.users}{" "}
              user(s) — would create {report.wouldCreate.projects} project(s),{" "}
              {report.wouldCreate.tickets} ticket(s), {report.wouldCreate.columns} column(s).
            </p>
            <p>
              Status mapping:{" "}
              {Object.entries(report.statusMapping)
                .map(([s, c]) => `${s} → ${c}`)
                .join(", ") || "none"}
            </p>
            {report.unmappedUsers.length > 0 ? (
              <p>
                Users with no member in this workspace (tickets stay unassigned):{" "}
                {report.unmappedUsers.join(", ")}
              </p>
            ) : null}
            {report.errors.map((e, i) => (
              <p key={i} className="text-risk">
                Error — row {e.row}, {e.field}: {e.message}
              </p>
            ))}
            {report.warnings.map((w, i) => (
              <p key={i} className="text-muted">
                Warning — row {w.row}, {w.field}: {w.message}
              </p>
            ))}
            {report.errors.length > 0 ? (
              <p className="text-risk">Fix the errors above before importing.</p>
            ) : null}
          </div>
        ) : null}
        {result ? (
          <div className="space-y-1 rounded-lg border border-line bg-canvas p-3 text-xs text-ink">
            <p className="font-medium">
              Imported: {result.createdTickets} ticket(s) created, {result.skippedExistingTickets}{" "}
              already imported (skipped), {result.createdProjects} project(s) created,{" "}
              {result.columnsCreated} column(s) created, {result.linkedParents} parent link(s).
            </p>
            {result.unmappedUsers.length > 0 ? (
              <p>
                Unassigned (unknown users — invite them, then re-import to assign):{" "}
                {result.unmappedUsers.join(", ")}
              </p>
            ) : null}
            {result.errors.map((e, i) => (
              <p key={i} className="text-risk">
                Skipped row {e.row}, {e.field}: {e.message}
              </p>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-muted">
          Statuses keep their source names and map to reporting categories (To Do / In Progress /
          Done). Attachments are not in CSV/JSON exports, so they are not imported in this slice.
        </p>
      </div>
    </Card>
  );
}

/**
 * Automation rule builder (Phase 2, worker-b) — trigger → action.
 * Lists rules, creates/edits them with per-action config fields from
 * the shared catalog, toggles them on/off, and runs the overdue sweep.
 * All API calls go through the typed clients in lib/api.ts — no fetch
 * in this component. Rules are workspace-admin only (AUTOMATIONS_MANAGE);
 * a member without the permission sees the API error below.
 */
function AutomationsCard() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<string>(AUTOMATION_TRIGGER_CATALOG[0]?.trigger ?? "ticket.created");
  const [action, setAction] = useState<string>(AUTOMATION_ACTION_CATALOG[0]?.action ?? "slack.post");
  const [toCategory, setToCategory] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  const actionDef = AUTOMATION_ACTION_CATALOG.find((a) => a.action === action);

  async function refresh() {
    setLoading(true);
    setStatus(null);
    try {
      setRules(await fetchAutomations());
    } catch (err) {
      setStatus(`Could not load automation rules: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setTrigger(AUTOMATION_TRIGGER_CATALOG[0]?.trigger ?? "ticket.created");
    setAction(AUTOMATION_ACTION_CATALOG[0]?.action ?? "slack.post");
    setToCategory("");
    setConfigValues({});
  }

  function startEdit(rule: AutomationRule) {
    setEditingId(rule.id);
    setName(rule.name);
    setTrigger(rule.trigger);
    setAction(rule.action);
    const filters = (rule.config["filters"] as Record<string, unknown> | undefined) ?? {};
    setToCategory(typeof filters["toCategory"] === "string" ? filters["toCategory"] : "");
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(rule.config)) {
      if (k === "filters") continue;
      values[k] = typeof v === "string" ? v : String(v ?? "");
    }
    setConfigValues(values);
    setStatus(null);
  }

  function buildConfig(): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(configValues)) {
      if (v.trim() === "") continue;
      config[k] = v;
    }
    if (toCategory) config["filters"] = { toCategory };
    return config;
  }

  async function save() {
    if (!name.trim()) {
      setStatus("Give the rule a name.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const payload = { name: name.trim(), trigger, action, config: buildConfig() };
      if (editingId) {
        setRules((rs) => rs.map((r) => (r.id === editingId ? { ...r, ...payload } : r)));
        await updateAutomation(editingId, payload);
        setStatus("Rule updated.");
      } else {
        const created = await createAutomation({ ...payload, isActive: true });
        setRules((rs) => [created, ...rs]);
        setStatus("Rule created.");
      }
      resetForm();
      await refresh();
    } catch (err) {
      setStatus(`Could not save rule: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Automations — trigger → action"
        subtitle="When something happens, do something — across Slack, GitHub, notifications and webhooks. Unconnected providers are skipped with a warning, never a crash."
      />
      <div className="space-y-4 px-5 py-4">
        {loading ? (
          <p className="text-xs text-muted">Loading rules…</p>
        ) : rules.length === 0 ? (
          <p className="text-xs text-muted">
            No rules yet. Try: ticket done → post to Slack, or ticket overdue → notify the
            assignee.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {rule.name}{" "}
                    <span className="text-xs font-normal text-muted">
                      {rule.trigger} → {rule.action}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {rule.isActive ? "Enabled" : "Disabled"}
                    {typeof rule.config["channel"] === "string" && rule.config["channel"]
                      ? ` · ${String(rule.config["channel"])}`
                      : ""}
                    {typeof rule.config["url"] === "string" && rule.config["url"]
                      ? ` · ${String(rule.config["url"])}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() => startEdit(rule)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const updated = await toggleAutomation(rule.id);
                        setRules((rs) => rs.map((r) => (r.id === rule.id ? updated : r)));
                      } catch (err) {
                        setStatus(`Could not toggle rule: ${(err as Error).message}`);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {rule.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className={`${btnSecondary} text-risk`}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await deleteAutomation(rule.id);
                        setRules((rs) => rs.filter((r) => r.id !== rule.id));
                      } catch (err) {
                        setStatus(`Could not delete rule: ${(err as Error).message}`);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-2xl border border-line bg-canvas p-4">
          <p className="text-sm font-medium text-ink">
            {editingId ? "Edit rule" : "New rule"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                className="w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Announce done tickets in Slack"
                aria-label="Rule name"
              />
            </Field>
            <Field label="When this happens (trigger)">
              <Select
                className="w-full"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                aria-label="Trigger"
              >
                {AUTOMATION_TRIGGER_CATALOG.map((t) => (
                  <option key={t.trigger} value={t.trigger}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Do this (action)">
              <Select
                className="w-full"
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setConfigValues({});
                }}
                aria-label="Action"
              >
                {AUTOMATION_ACTION_CATALOG.map((a) => (
                  <option key={a.action} value={a.action}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            {(trigger === "ticket.status_changed" || trigger === "ticket.done") && (
              <Field
                label="Only when moving to (optional filter)"
                hint="Leave empty to fire on every status change."
              >
                <Select
                  className="w-full"
                  value={toCategory}
                  onChange={(e) => setToCategory(e.target.value)}
                  aria-label="To-category filter"
                >
                  <option value="">Any column</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </Select>
              </Field>
            )}
          </div>
          {actionDef ? (
            <p className="text-xs text-muted">{actionDef.description}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {actionDef?.configFields.map((field) => (
              <Field key={field.key} label={field.label} hint={field.hint}>
                {field.type === "textarea" ? (
                  <Textarea
                    className="w-full"
                    value={configValues[field.key] ?? ""}
                    onChange={(e) =>
                      setConfigValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    aria-label={field.label}
                  />
                ) : field.type === "select" ? (
                  <Select
                    className="w-full"
                    value={configValues[field.key] ?? ""}
                    onChange={(e) =>
                      setConfigValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                    aria-label={field.label}
                  >
                    {(field.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    className="w-full"
                    value={configValues[field.key] ?? ""}
                    onChange={(e) =>
                      setConfigValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    aria-label={field.label}
                  />
                )}
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editingId ? "Save changes" : "Create rule"}
            </button>
            {editingId ? (
              <button type="button" className={btnSecondary} disabled={busy} onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setStatus(null);
                try {
                  const result: AutomationSweepResult = await runAutomationSweep();
                  setStatus(
                    `Overdue sweep: ${result.staleTickets} stale ticket(s), ${result.evaluated} rule action(s) evaluated.`,
                  );
                } catch (err) {
                  setStatus(`Sweep failed: ${(err as Error).message}`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Running…" : "Run overdue sweep"}
            </button>
          </div>
          <p className="text-xs text-muted">
            The overdue sweep also runs on a schedule — the worker calls the same endpoint.{" "}
            <Zap className="inline h-3 w-3" /> Placeholders in templates: {"{ticket.key}"}{" "}
            {"{ticket.title}"} {"{trigger}"}.
          </p>
        </div>
        {status ? <p className="text-xs text-muted">{status}</p> : null}
      </div>
    </Card>
  );
}

/** Live OAuth providers (Phase 2) — `key` is the API provider enum; null = coming soon. */
const providers = [
  {
    key: "SLACK",
    name: "Slack",
    tier: "Tier 1 — native",
    desc: "Channel alerts, task from message, daily digest",
    icon: MessageSquare,
  },
  {
    key: "GITHUB",
    name: "GitHub",
    tier: "Tier 1 — native",
    desc: "PRs linked to tickets, status on merge",
    icon: Github,
  },
  {
    key: "NOTION",
    name: "Notion",
    tier: "Tier 1 — native",
    desc: "Docs synced into Doc Hub",
    icon: FileText,
  },
  {
    key: "GOOGLE_CALENDAR",
    name: "Google (Calendar, Gmail, Drive)",
    tier: "Tier 1 — native",
    desc: "Deadlines as events, task from email, attach Drive files",
    icon: Calendar,
  },
  {
    key: "WEBHOOK",
    name: "Webhooks",
    tier: "Tier 3 — escape hatch",
    desc: "Generic in/out webhooks — also how Zapier / Make connect",
    icon: Link2,
  },
  {
    key: null,
    name: "Microsoft Teams",
    tier: "Tier 2",
    desc: "Alerts + meetings",
    icon: MessageSquare,
  },
  { key: null, name: "Jira", tier: "Tier 2", desc: "Import / migrate", icon: Link2 },
  { key: null, name: "Figma", tier: "Tier 2", desc: "Embed designs in tickets", icon: Link2 },
  { key: null, name: "Linear", tier: "Tier 2", desc: "Two-way issue sync", icon: Link2 },
  {
    key: null,
    name: "Zapier / Make",
    tier: "Tier 3 — escape hatch",
    desc: "5,000+ apps via the generic webhook above",
    icon: Link2,
  },
];

function WebhookCard() {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [configuredUrl, setConfiguredUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch(`${apiUrl}/integrations/webhook/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.url === "string") setConfiguredUrl(d.url);
      })
      .catch(() => null);
  }, []);

  return (
    <Card>
      <div id="webhook-config">
        <CardHeader
          title="Generic webhook — outgoing + incoming"
          subtitle="Zapier / Make use this same webhook. Outgoing: Agilytics POSTs events to your URL, signed with your secret (X-Agilytics-Signature). Incoming: POST a signed { projectId, title } to /api/v1/integrations/webhook/incoming to create a ticket."
        />
      </div>
      <div className="space-y-3 px-5 py-4">
        {configuredUrl ? (
          <p className="text-xs text-ink">
            Configured outgoing URL: <code>{configuredUrl}</code> (secret is never shown again).
          </p>
        ) : (
          <p className="text-xs text-muted">No outgoing webhook configured yet.</p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="min-w-64 flex-1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/…"
            aria-label="Webhook URL"
          />
          <Input
            className="w-64"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Shared secret (min 16 chars)"
            aria-label="Webhook secret"
            type="password"
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !url.trim() || secret.length < 16}
            onClick={async () => {
              setBusy(true);
              setStatus(null);
              try {
                await postJson("/integrations/webhook/config", { url: url.trim(), secret });
                setConfiguredUrl(url.trim());
                setSecret("");
                setStatus("Webhook configured (secret stored encrypted).");
              } catch (err) {
                setStatus(`Could not save: ${(err as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save webhook"}
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={busy || !configuredUrl}
            onClick={async () => {
              setBusy(true);
              setStatus(null);
              try {
                await postJson("/integrations/webhook/test", { event: "test" });
                setStatus("Test event sent to your URL.");
              } catch (err) {
                setStatus(`Test failed: ${(err as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            Send test event
          </button>
        </div>
        {status ? <p className="text-xs text-muted">{status}</p> : null}
      </div>
    </Card>
  );
}

export function ConnectionsPage() {
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  const refreshConnections = async () => {
    try {
      const res = await apiFetch(`${apiUrl}/integrations`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        connected?: { provider: string; isActive: boolean }[];
      };
      setConnectedProviders(
        (data.connected ?? []).filter((c) => c.isActive).map((c) => c.provider),
      );
    } catch {
      // Offline / API down — the page still renders; cards show their own errors.
    }
  };

  useEffect(() => {
    void refreshConnections();
  }, []);

  const connectProvider = async (provider: string) => {
    setBusyProvider(provider);
    setConnectStatus(null);
    try {
      const res = await apiFetch(`${apiUrl}/integrations/${provider}/authorize`);
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(err?.message ?? `Request failed: ${res.status}`);
      }
      const { authorizeUrl } = (await res.json()) as { authorizeUrl: string };
      window.open(authorizeUrl, "_blank", "width=600,height=700");
      setConnectStatus(
        `Opened ${provider} authorisation in a new tab — approve it there, then refresh this page.`,
      );
    } catch (err) {
      setConnectStatus(`Could not connect ${provider}: ${(err as Error).message}`);
    } finally {
      setBusyProvider(null);
    }
  };

  const disconnectProvider = async (provider: string) => {
    setBusyProvider(provider);
    setConnectStatus(null);
    try {
      await postJson(`/integrations/${provider}/disconnect`, { provider });
      await refreshConnections();
      setConnectStatus(`${provider} disconnected.`);
    } catch (err) {
      setConnectStatus(`Could not disconnect ${provider}: ${(err as Error).message}`);
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Connections" />
      <main className="space-y-4 p-6">
        <AutomationsCard />
        <SlackCard />
        <GitHubCard />
        <ImportCard />
        <WebhookCard />
        <Card>
          <CardHeader
            title="Connect your tools"
            subtitle="Live OAuth (Phase 2) — Connect opens the provider in a new tab; the callback lands on /connections/callback"
          />
          {connectStatus ? <p className="px-5 pt-3 text-xs text-muted">{connectStatus}</p> : null}
          <ul className="divide-y divide-line">
            {providers.map((p) => {
              const Icon = p.icon;
              const on = p.key !== null && connectedProviders.includes(p.key);
              return (
                <li key={p.name} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted" />
                    <div>
                      <p className="text-sm font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-muted">
                        {p.tier} · {p.desc}
                      </p>
                    </div>
                  </div>
                  {p.key === null ? (
                    <span className="rounded-full bg-canvas px-4 py-1.5 text-xs font-medium text-muted border border-line">
                      Coming soon
                    </span>
                  ) : p.key === "WEBHOOK" ? (
                    <a
                      href="#webhook-config"
                      className="rounded-full border border-line bg-canvas px-4 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
                    >
                      Configure
                    </a>
                  ) : on ? (
                    <button
                      type="button"
                      disabled={busyProvider === p.key}
                      onClick={() => void disconnectProvider(p.key as string)}
                      className="rounded-full bg-done px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Connected — Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyProvider === p.key}
                      onClick={() => void connectProvider(p.key as string)}
                      className="rounded-full border border-line bg-canvas px-4 py-1.5 text-xs font-medium text-ink disabled:opacity-50"
                    >
                      {busyProvider === p.key ? "Opening…" : "Connect"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </main>
    </div>
  );
}
