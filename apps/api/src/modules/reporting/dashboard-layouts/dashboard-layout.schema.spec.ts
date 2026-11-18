import { describe, expect, it } from "@jest/globals";
import { dashboardLayoutSchema } from "./dashboard-layout.schema";
import { defaultLayoutFor as serverDefault } from "./templates";

const valid = {
  widgets: [
    { id: "w1", type: "kpi", x: 0, y: 0, w: 4, h: 1, config: { stat: "velocity" } },
    { id: "w2", type: "velocity", x: 4, y: 0, w: 8, h: 2, config: { timeRange: "6w" } },
  ],
  ui: { density: "comfortable", sidebarCollapsed: false, navItems: ["dashboard"] },
};

describe("dashboard layout schema", () => {
  it("accepts a valid layout", () => {
    expect(dashboardLayoutSchema.parse(valid).widgets).toHaveLength(2);
  });

  it("rejects an unknown widget type", () => {
    expect(() =>
      dashboardLayoutSchema.parse({
        ...valid,
        widgets: [{ ...valid.widgets[0], type: "burndown" }],
      }),
    ).toThrow();
  });

  it("rejects duplicate widget ids", () => {
    expect(() =>
      dashboardLayoutSchema.parse({
        ...valid,
        widgets: [valid.widgets[0], { ...valid.widgets[1], id: "w1" }],
      }),
    ).toThrow(/unique/);
  });

  it("rejects a width outside the 12-column grid", () => {
    expect(() =>
      dashboardLayoutSchema.parse({
        ...valid,
        widgets: [{ ...valid.widgets[0], w: 13 }],
      }),
    ).toThrow();
  });

  it("rejects a non-uuid scope id", () => {
    expect(() =>
      dashboardLayoutSchema.parse({
        ...valid,
        widgets: [{ ...valid.widgets[0], config: { projectId: "not-a-uuid" } }],
      }),
    ).toThrow();
  });

  it("every role template parses as a valid layout", () => {
    for (const template of ["manager", "lead", "developer", "viewer"] as const) {
      expect(() => dashboardLayoutSchema.parse(serverDefault(template))).not.toThrow();
    }
  });

  it("template layouts have unique widget ids inside the grid", () => {
    for (const template of ["manager", "lead", "developer", "viewer"] as const) {
      const layout = serverDefault(template);
      const ids = new Set(layout.widgets.map((w) => w.id));
      expect(ids.size).toBe(layout.widgets.length);
      for (const w of layout.widgets) {
        expect(w.x + w.w).toBeLessThanOrEqual(12);
      }
    }
  });
});
