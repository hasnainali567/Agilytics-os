import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Sidebar } from "./components/layout";
import { RequirePlatformAdmin } from "./components/RequirePlatformAdmin";
import { AdminPage } from "./pages/AdminPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { HomePage } from "./pages/HomePage";
import { InboxPage } from "./pages/InboxPage";
import { RolesPage } from "./pages/RolesPage";
import { TicketBoardPage } from "./pages/TicketBoardPage";
import { WorkflowSettingsPage } from "./pages/WorkflowSettingsPage";
import { PlaceholderPage, ReportsPage } from "./pages/ReportsPage";

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  ),
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
  component: () => <PlaceholderPage title="Projects" />,
});
const sprintsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sprints",
  component: TicketBoardPage,
});
const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/members",
  component: () => <PlaceholderPage title="Members" />,
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
  indexRoute,
  reportsRoute,
  projectsRoute,
  sprintsRoute,
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
