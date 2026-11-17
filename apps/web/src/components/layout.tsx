import { Link } from "@tanstack/react-router";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/reports", label: "Reports" },
  { to: "/projects", label: "Projects" },
  { to: "/sprints", label: "Sprints" },
  { to: "/members", label: "Members" },
  { to: "/connections", label: "Connections" },
  { to: "/settings/workflows", label: "Workflows" },
  { to: "/admin", label: "Platform Admin" },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-navy-900 text-white">
      <div className="px-5 py-5">
        <p className="text-lg font-bold tracking-tight">Agilytics OS</p>
        <p className="text-xs text-slate-400">AI-powered team OS</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-navy-800 hover:text-white [&.active]:bg-navy-700 [&.active]:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-navy-800 px-5 py-4 text-xs text-slate-400">
        v2.0 — from scratch
        <br />
        MOCK data until the API lands
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
