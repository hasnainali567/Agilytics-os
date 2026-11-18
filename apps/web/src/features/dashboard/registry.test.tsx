import { cleanup, render, screen } from "@testing-library/react";
import type { DashboardSummary } from "@agilytics/shared";
import { afterEach, describe, expect, it } from "vitest";
import { KpiWidget } from "./widgets/KpiWidget";
import { VelocityWidget } from "./widgets/VelocityWidget";
import { AiBriefWidget } from "./widgets/AiBriefWidget";

const summary: DashboardSummary = {
  kpis: {
    activeProjects: 3,
    activeProjectsDelta: 1,
    ticketsDoneThisSprint: 12,
    ticketsDoneDelta: 2,
    velocityPoints: 34,
    velocityDelta: 5,
    atRiskMembers: 1,
    overdueTickets: 2,
  },
  velocity: [
    { week: "2026-11-02", completed: 20, planned: 25 },
    { week: "2026-11-09", completed: 34, planned: 30 },
  ],
  members: [
    {
      id: "m-0",
      tenantId: "t",
      userId: "u1",
      name: "Aisha",
      email: "a@example.com",
      role: "MEMBER",
      activeTickets: 3,
      completedPoints: 10,
      status: "ACTIVE",
    },
  ],
  today: {
    date: "2026-11-18",
    updatedMembers: 1,
    totalMembers: 1,
    updatedNames: ["Aisha"],
    silentNames: [],
    openBlockers: 0,
    staleTickets: [],
  },
};

const noop = () => {};

// Vitest has no globals/auto-cleanup configured, so unmount between
// tests — otherwise an earlier widget's "34" leaks into later queries.
afterEach(() => cleanup());

describe("dashboard widgets render real summary data", () => {
  it("KPI widget shows the chosen stat with an explicit trend sign", () => {
    render(<KpiWidget summary={summary} config={{ stat: "velocity" }} onClearScope={noop} />);
    expect(screen.getByText("Sprint velocity")).toBeTruthy();
    expect(screen.getByText("34")).toBeTruthy();
    expect(screen.getByText("+5 vs last sprint")).toBeTruthy();
  });

  it("velocity widget renders one progress bar per week", () => {
    render(<VelocityWidget summary={summary} config={{ timeRange: "6w" }} onClearScope={noop} />);
    expect(screen.getByText("2026-11-02")).toBeTruthy();
    expect(screen.getByText("34 / 30 pts · 100%")).toBeTruthy();
  });

  it("a scoped widget renders the empty state, never another scope's data", () => {
    render(
      <KpiWidget
        summary={summary}
        config={{ stat: "velocity", projectId: "00000000-0000-4000-8000-000000000001" }}
        onClearScope={noop}
      />,
    );
    expect(screen.getByText("No data for this scope yet")).toBeTruthy();
    expect(screen.queryByText("34")).toBeNull();
  });

  it("AI brief widget is a slot only — no invented brief content", () => {
    render(<AiBriefWidget summary={summary} config={{}} onClearScope={noop} />);
    expect(screen.getByText("Your daily brief will live here")).toBeTruthy();
  });
});
