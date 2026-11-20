import { useEffect, useState } from "react";
import {
  AudioWaveform,
  Bell,
  Calendar,
  ChartNoAxesColumn,
  ChevronDown,
  FileText,
  FolderKanban,
  Github,
  Home,
  Inbox,
  KanbanSquare,
  Link2,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  Sun,
  Timer,
  Users,
  Workflow,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "./ui";
import { LiveIndicator } from "./LiveIndicator";
import { apiFetch, getCurrentUser, logout } from "../lib/authFetch";
import { apiUrl } from "../lib/query-client";

/**
 * Shell — Kanban main design ("Creating an application for aero.com",
 * 2026-11-20). Thin vertical icon rail on the far left (user avatar
 * chip top, icon-only MENU group, APPS group of connected
 * integrations, theme toggle + logout at the bottom) and a TopBar with
 * the logo + page title left, "Your work / Projects / Filters /
 * Dashboards" dropdown menus, a purple "+ Create" button, voice
 * search pill, search, messages / bell / settings, LiveIndicator and
 * the user avatar at the right. Page bg #E9EEF5, white cards,
 * vivid purple #6C5CE7 primary, near-black #111827 text. No gradients,
 * no glass, no dark surfaces.
 */

// Rail MENU: every destination, icon only, tooltips via title.
const railNav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/boards", label: "Boards", icon: KanbanSquare },
  { to: "/sprints", label: "Sprints", icon: Timer },
  { to: "/members", label: "Members", icon: Users },
  { to: "/reports", label: "Reports", icon: ChartNoAxesColumn },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/connections", label: "Connections", icon: Link2 },
  { to: "/settings/workflows", label: "Workflows", icon: Workflow },
  { to: "/settings/roles", label: "Roles & permissions", icon: Settings2 },
  { to: "/admin", label: "Platform Admin", icon: ShieldCheck },
];

// APPS rail group — connected integrations, tinted per provider when
// connected, greyed-out when not. Each links to /connections.
const appsProviders = [
  { provider: "slack", label: "Slack", icon: MessageSquare, tint: "#4A154B" },
  { provider: "github", label: "GitHub", icon: Github, tint: "#111827" },
  { provider: "notion", label: "Notion", icon: FileText, tint: "#111827" },
  { provider: "google", label: "Google", icon: Calendar, tint: "#4285F4" },
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

const THEME_KEY = "agilytics.theme";

function readSavedTheme(): "light" | "dark" {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function Sidebar() {
  const user = getCurrentUser();
  const displayName = user?.name ?? user?.email.split("@")[0] ?? "Demo User";
  const displayEmail = user?.email ?? "demo@agilytics.local";
  const displayRole = user?.role ?? "Member";
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(readSavedTheme);

  // Theme toggle: sets data-theme on <html> (see index.css — dark is a
  // backdrop-only theme by design) and persists the choice. main.tsx
  // re-applies the saved value before first paint.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // localStorage unavailable — the choice just won't persist.
    }
  }, [theme]);

  // Which integrations are actually connected (same /integrations shape
  // ConnectionsPage reads). Offline / API down: all APPS icons greyed-out.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(`${apiUrl}/integrations`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          connected?: { provider: string; isActive: boolean }[];
        };
        setConnectedProviders(
          (data.connected ?? []).filter((c) => c.isActive).map((c) => c.provider),
        );
      } catch {
        // Keep the greyed-out state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onLogout() {
    logout();
    // Full reload so cached queries and in-memory state are dropped too.
    window.location.href = "/login";
  }

  // h-full of the h-screen shell: the rail is always exactly viewport
  // height and never scrolls; only the content column scrolls. The MENU
  // list itself scrolls internally on short viewports so the avatar,
  // APPS group and bottom controls never leave the rail.
  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center rounded-card border border-line bg-card py-3 text-ink">
      <span
        title={`${displayName} — ${displayEmail} · ${displayRole}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent"
      >
        {initialsFor(displayName)}
      </span>
      <nav
        className="mt-5 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto"
        aria-label="Main"
      >
        <span className="mb-1 text-[9px] font-bold tracking-widest text-muted">MENU</span>
        {railNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-muted transition-colors hover:bg-page hover:text-ink [&.active]:bg-accent [&.active]:text-white"
            >
              <Icon size={18} strokeWidth={2} />
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 flex shrink-0 flex-col items-center gap-1 border-t border-line pt-3">
        <span className="text-[9px] font-bold tracking-widest text-muted">APPS</span>
        {appsProviders.map((app) => {
          const Icon = app.icon;
          const connected = connectedProviders.includes(app.provider);
          return (
            <Link
              key={app.provider}
              to="/connections"
              title={`${app.label}${connected ? " — connected" : " — not connected"}`}
              aria-label={`${app.label}${connected ? " — connected" : " — not connected"}`}
              style={connected ? { color: app.tint } : undefined}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-colors hover:bg-page hover:text-ink ${
                connected ? "" : "text-muted opacity-50"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
            </Link>
          );
        })}
      </div>
      <div className="mt-4 flex shrink-0 flex-col items-center gap-1 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-muted transition-colors hover:bg-page hover:text-ink"
        >
          {theme === "dark" ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
        </button>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          title={`Log out (${displayName})`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-muted transition-colors hover:bg-page hover:text-ink"
        >
          <LogOut size={18} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}

// TopBar dropdown: a simple menu of Links to existing pages only.
// No new routes are invented here.
function TopBarMenu({ label, items }: { label: string; items: { to: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1 rounded-[10px] px-2.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
      >
        {label}
        <ChevronDown
          size={14}
          aria-hidden
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-[12px] border border-line bg-card p-1 shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
            {items.map((item) => (
              <Link
                key={item.to + item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className="block rounded-[8px] px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

const topBarMenus = [
  {
    label: "Your work",
    items: [
      { to: "/boards", label: "Boards" },
      { to: "/inbox", label: "Inbox" },
      { to: "/sprints", label: "Sprints" },
    ],
  },
  {
    label: "Projects",
    items: [
      { to: "/projects", label: "All projects" },
      { to: "/boards", label: "Boards" },
    ],
  },
  {
    label: "Filters",
    items: [
      { to: "/boards", label: "Boards" },
      { to: "/reports", label: "Reports" },
    ],
  },
  {
    label: "Dashboards",
    items: [
      { to: "/", label: "Dashboard" },
      { to: "/reports", label: "Reports" },
    ],
  },
];

export function TopBar({ title }: { title: string }) {
  const user = getCurrentUser();
  const displayName = user?.name ?? "Demo User";
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-white">
          A
        </span>
        <h1 className="truncate text-lg font-bold leading-tight text-ink sm:text-xl">{title}</h1>
      </div>
      <nav aria-label="Quick navigation" className="hidden min-w-0 items-center lg:flex">
        {topBarMenus.map((menu) => (
          <TopBarMenu key={menu.label} label={menu.label} items={menu.items} />
        ))}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Link
          to="/boards"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          <Plus size={16} strokeWidth={2.5} />
          Create
        </Link>
        <button
          type="button"
          aria-disabled="true"
          aria-label="Voice search (coming soon)"
          title="Voice search — coming soon"
          className="hidden items-center gap-1.5 rounded-full border border-line bg-card px-3 py-2 text-xs font-medium text-muted xl:inline-flex"
        >
          <AudioWaveform size={15} />
          Voice search
        </button>
        <div className="relative hidden md:block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input type="search" placeholder="Search" className="w-44 bg-page py-2.5 pl-9 lg:w-52" />
        </div>
        <Link
          to="/inbox"
          aria-label="Messages"
          title="Messages"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-page text-muted transition-colors hover:text-ink"
        >
          <MessageSquare size={17} />
        </Link>
        <Link
          to="/inbox"
          aria-label="Notifications"
          title="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-page text-muted transition-colors hover:text-ink"
        >
          <Bell size={17} />
        </Link>
        <Link
          to="/settings/roles"
          aria-label="Settings"
          title="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-page text-muted transition-colors hover:text-ink"
        >
          <Settings size={17} />
        </Link>
        <LiveIndicator />
        <span
          title={displayName}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-light text-sm font-semibold text-accent"
        >
          {initialsFor(displayName)}
        </span>
      </div>
    </header>
  );
}
