import { useState } from "react";
import { Link2, MessageSquare, Github, FileText, Calendar, Mail, Upload } from "lucide-react";
import { TopBar } from "../components/layout";
import { Card, CardHeader } from "../components/ui";
import { useConnectionsStore } from "../lib/connections-store";
import { apiUrl } from "../lib/query-client";
import { apiFetch } from "../lib/authFetch";

/** Connections hub — Tier 1/2/3 catalog from docs/INTEGRATIONS.md.
 *  Toggles are local until the Integrations API lands; connecting for real
 *  (OAuth) is the next slice. The Slack test post, GitHub PR list and
 *  Jira/ClickUp import below call the real Phase 1 API — no mock data:
 *  empty states stay empty until a repo is entered or a file uploaded. */

const inputCls =
  "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-forest";
const btnPrimary =
  "rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-line bg-panel px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50";

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
        <div className="flex flex-wrap gap-2">
          <input
            className={inputCls}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="#agilytics"
            aria-label="Slack channel"
          />
          <input
            className={`${inputCls} min-w-64 flex-1`}
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
        <div className="flex flex-wrap gap-2">
          <input
            className={inputCls}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner"
            aria-label="Repo owner"
          />
          <input
            className={inputCls}
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="Repository"
            aria-label="Repository"
          />
          <input
            className={inputCls}
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
          <select
            className={inputCls}
            value={source}
            onChange={(e) => setSource(e.target.value as "JIRA" | "CLICKUP")}
            aria-label="Import source"
          >
            <option value="JIRA">Jira</option>
            <option value="CLICKUP">ClickUp</option>
          </select>
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

const providers = [
  {
    name: "Slack",
    tier: "Tier 1 — native",
    desc: "Channel alerts, task from message, daily digest",
    icon: MessageSquare,
  },
  {
    name: "GitHub",
    tier: "Tier 1 — native",
    desc: "PRs linked to tickets, status on merge",
    icon: Github,
  },
  { name: "Notion", tier: "Tier 1 — native", desc: "Docs synced into Doc Hub", icon: FileText },
  {
    name: "Google Calendar",
    tier: "Tier 1 — native",
    desc: "Deadlines as events, meeting → actions",
    icon: Calendar,
  },
  {
    name: "Gmail / Drive",
    tier: "Tier 1 — native",
    desc: "Attach files, task from email",
    icon: Mail,
  },
  { name: "Microsoft Teams", tier: "Tier 2", desc: "Alerts + meetings", icon: MessageSquare },
  { name: "Jira", tier: "Tier 2", desc: "Import / migrate", icon: Link2 },
  { name: "Figma", tier: "Tier 2", desc: "Embed designs in tickets", icon: Link2 },
  { name: "Linear", tier: "Tier 2", desc: "Two-way issue sync", icon: Link2 },
  {
    name: "Zapier / Make",
    tier: "Tier 3 — escape hatch",
    desc: "5,000+ apps via automations",
    icon: Link2,
  },
  { name: "Webhooks", tier: "Tier 3 — escape hatch", desc: "Generic in/out webhooks", icon: Link2 },
];

export function ConnectionsPage() {
  const { connected, toggle } = useConnectionsStore();
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Connections" />
      <main className="space-y-4 p-6">
        <SlackCard />
        <GitHubCard />
        <ImportCard />
        <Card>
          <CardHeader
            title="Connect your tools"
            subtitle="Toggles are stored locally until live OAuth lands — Slack and GitHub above already call the real API"
          />
          <ul className="divide-y divide-line">
            {providers.map((p) => {
              const Icon = p.icon;
              const on = connected[p.name] ?? false;
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
                  <button
                    type="button"
                    onClick={() => toggle(p.name)}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                      on ? "bg-done text-white" : "bg-canvas text-ink border border-line"
                    }`}
                  >
                    {on ? "Connected" : "Connect"}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </main>
    </div>
  );
}
