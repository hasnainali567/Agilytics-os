import { format } from "date-fns";
import { Link2, MessageSquare, Github, FileText, Calendar, Mail } from "lucide-react";
import { TopBar } from "../components/layout";
import { Card, CardHeader } from "../components/ui";
import { useConnectionsStore } from "../lib/connections-store";

/** Connections hub — Tier 1/2/3 catalog from docs/INTEGRATIONS.md.
 *  Toggles are local until the Integrations API lands; connecting for real
 *  (OAuth) is the next slice. */
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
        <Card>
          <CardHeader
            title="Connect your tools"
            subtitle={`Last sync check ${format(new Date(), "PPP")} — toggles are local until OAuth lands`}
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
