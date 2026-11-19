import {
  Bell,
  ChartNoAxesColumn,
  FolderKanban,
  KanbanSquare,
  Home,
  Inbox,
  Link2,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  Timer,
  Users,
  Workflow,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getCurrentUser, logout } from "../lib/authFetch";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/reports", label: "Reports", icon: ChartNoAxesColumn },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/boards", label: "Boards", icon: KanbanSquare },
  { to: "/sprints", label: "Sprints", icon: Timer },
  { to: "/members", label: "Members", icon: Users },
  { to: "/connections", label: "Connections", icon: Link2 },
  { to: "/settings/workflows", label: "Workflows", icon: Workflow },
  { to: "/settings/roles", label: "Roles", icon: Settings2 },
  { to: "/admin", label: "Platform Admin", icon: ShieldCheck },
];

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar() {
  const user = getCurrentUser();
  const displayName = user?.name ?? user?.email.split("@")[0] ?? "Demo User";
  const displayEmail = user?.email ?? "demo@agilytics.local";
  const displayRole = user?.role ?? "Member";

  function onLogout() {
    logout();
    // Full reload so cached queries and in-memory state are dropped too.
    window.location.href = "/login";
  }

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
      <div className="border-t border-line px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-[14px] bg-canvas px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-light text-xs font-bold text-forest">
            {initialsFor(displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{displayName}</span>
            <span className="block truncate text-xs text-muted">{displayEmail}</span>
            <span className="mt-0.5 inline-block rounded-full bg-pill px-2 py-0.5 text-[11px] font-medium text-ink">
              {displayRole}
            </span>
          </span>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-panel hover:text-ink"
          >
            <LogOut size={16} />
          </button>
        </div>
        <p className="mt-2 px-2 text-[11px] text-muted">v2.0 — from scratch · Live API data</p>
      </div>
    </aside>
  );
}

export function TopBar({ title }: { title: string }) {
  const user = getCurrentUser();
  const displayName = user?.name ?? "Demo User";
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
            className="w-64 rounded-lg border border-line bg-canvas py-2 pl-9 pr-3 text-sm outline-none focus:border-forest"
          />
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-canvas text-muted hover:text-ink"
        >
          <Bell size={17} />
        </button>
        <span
          title={displayName}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-light text-sm font-semibold text-forest"
        >
          {initialsFor(displayName)}
        </span>
      </div>
    </header>
  );
}
