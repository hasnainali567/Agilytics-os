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
    return (
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <div className="flex-1">
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
