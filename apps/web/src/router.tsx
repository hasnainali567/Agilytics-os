import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { Sidebar } from "./components/layout";
import { RequirePlatformAdmin } from "./components/RequirePlatformAdmin";
import { isAuthenticated } from "./lib/authFetch";
import { AdminPage } from "./pages/AdminPage";
import { ConnectionsCallbackPage } from "./pages/ConnectionsCallbackPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { HomePage } from "./pages/HomePage";
import { InboxPage } from "./pages/InboxPage";
import { LoginPage } from "./pages/LoginPage";
import { MembersPage } from "./pages/MembersPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RolesPage } from "./pages/RolesPage";
import { SprintsPage } from "./pages/SprintsPage";
import { TicketBoardPage } from "./pages/TicketBoardPage";
import { WorkflowSettingsPage } from "./pages/WorkflowSettingsPage";

const rootRoute = createRootRoute({
  // Guard every route: no stored token means back to /login. The login
  // route itself is exempt so it can never redirect to itself.
  beforeLoad: ({ location }) => {
    if (location.pathname === "/login") return;
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: function Root() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    // The login page renders outside the sidebar shell.
    if (pathname === "/login") {
      return <Outlet />;
    }
    // Fixed-height shell (Kanban main design, 2026-11-20): the icon rail
    // is exactly viewport height and never scrolls; only the content
    // column scrolls (overflow-y-auto). The p-4 / gap-4 is the page
    // breathing room around the shell. `theme-shell` lets the rail
    // theme toggle darken the backdrop in dark mode (see index.css).
    return (
      <div className="theme-shell flex h-screen gap-4 overflow-hidden bg-page p-4">
        <Sidebar />
        <div className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    );
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  // Already signed in — no need to see the login form again.
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  component: ReportsPage,
});
const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: ProjectsPage,
});
const sprintsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sprints",
  component: SprintsPage,
});
const boardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/boards",
  component: TicketBoardPage,
});
const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/members",
  component: MembersPage,
});
const connectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connections",
  component: ConnectionsPage,
});
const connectionsCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connections/callback",
  component: ConnectionsCallbackPage,
});
const workflowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/workflows",
  component: WorkflowSettingsPage,
});
const rolesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/roles",
  component: RolesPage,
});
const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/inbox",
  component: InboxPage,
});
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <RequirePlatformAdmin>
      <AdminPage />
    </RequirePlatformAdmin>
  ),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  indexRoute,
  reportsRoute,
  projectsRoute,
  sprintsRoute,
  boardsRoute,
  membersRoute,
  connectionsRoute,
  connectionsCallbackRoute,
  workflowsRoute,
  rolesRoute,
  inboxRoute,
  adminRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
