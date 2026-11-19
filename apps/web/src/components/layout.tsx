import {
  Bell,
  ChartNoAxesColumn,
  FolderKanban,
  Home,
  Inbox,
  Link2,
  Search,
  Settings2,
  ShieldCheck,
  Timer,
  Users,
  Workflow,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/reports", label: "Reports", icon: ChartNoAxesColumn },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/sprints", label: "Sprints", icon: Timer },
  { to: "/members", label: "Members", icon: Users },
  { to: "/connections", label: "Connections", icon: Link2 },
  { to: "/settings/workflows", label: "Workflows", icon: Workflow },
  { to: "/settings/roles", label: "Roles", icon: Settings2 },
  { to: "/admin", label: "Platform Admin", icon: ShieldCheck },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col rounded-[26px] bg-panel text-ink">
      <div className="px-5 py-5">
        <p className="text-lg font-bold tracking-tight">Agilytics OS</p>
        <p className="text-xs text-muted">AI-powered team OS</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 rounded-full px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink [&.active]:bg-lime [&.active]:text-ink"
            >
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line px-5 py-4 text-xs text-muted">
        v2.0 — from scratch
        <br />
        Live API data
      </div>
    </aside>
  );
}

export function TopBar({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-panel px-6 py-4">
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            placeholder="Search (⌘K — coming soon)"
            className="w-64 rounded-lg border border-line bg-canvas py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500"
          />
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-canvas text-muted hover:text-ink"
        >
          <Bell size={17} />
        </button>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600">
          JD
        </span>
      </div>
    </header>
  );
}
