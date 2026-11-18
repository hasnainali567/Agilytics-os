import { Link } from "@tanstack/react-router";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/inbox", label: "Inbox" },
  { to: "/reports", label: "Reports" },
  { to: "/projects", label: "Projects" },
  { to: "/sprints", label: "Sprints" },
  { to: "/members", label: "Members" },
  { to: "/connections", label: "Connections" },
  { to: "/settings/workflows", label: "Workflows" },
  { to: "/settings/roles", label: "Roles" },
  { to: "/admin", label: "Platform Admin" },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col rounded-[26px] bg-panel text-ink">
      <div className="px-5 py-5">
        <p className="text-lg font-bold tracking-tight">Agilytics OS</p>
        <p className="text-xs text-muted">AI-powered team OS</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="block rounded-full px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink [&.active]:bg-lime [&.active]:text-ink"
          >
            {item.label}
          </Link>
        ))}
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
        <input
          type="search"
          placeholder="Search (⌘K — coming soon)"
          className="w-64 rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-primary-500"
        />
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600">
          JD
        </span>
      </div>
    </header>
  );
}
