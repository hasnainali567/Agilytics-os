import { describe, expect, it } from "vitest";
import { addWidget, pack, removeWidget, resizeWidget, swapWidgets } from "./layoutOps";
import { WIDGET_REGISTRY } from "./registry";
import { defaultLayoutFor, ROLE_TEMPLATES } from "./templates";
import { WIDGET_TYPES } from "./types";

describe("role templates", () => {
  it.each(["manager", "lead", "developer", "viewer"] as const)(
    "%s template is a valid grid layout",
    (template) => {
      const layout = defaultLayoutFor(template);
      const ids = new Set(layout.widgets.map((w) => w.id));
      expect(ids.size).toBe(layout.widgets.length);
      for (const w of layout.widgets) {
        expect(WIDGET_TYPES).toContain(w.type);
        expect(w.x + w.w).toBeLessThanOrEqual(12);
        expect(w.w).toBeGreaterThanOrEqual(1);
        expect(w.h).toBeGreaterThanOrEqual(1);
      }
      expect(layout.ui.density).toBe("comfortable");
      expect(layout.ui.sidebarCollapsed).toBe(false);
    },
  );

  it("manager template opens with the Agibankz bottom 3 columns", () => {
    const types = defaultLayoutFor("manager").widgets.map((w) => w.type);
    expect(types).toContain("workload");
    expect(types).toContain("velocity");
    expect(types).toContain("today-feed");
  });

  it("templates do not invent colours — the theme is fixed", () => {
    for (const template of Object.values(ROLE_TEMPLATES)) {
      expect(JSON.stringify(template)).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});

describe("layout operations", () => {
  it("pack keeps widgets inside the 12-column grid without overlap", () => {
    const layout = defaultLayoutFor("manager");
    const packed = pack(layout.widgets);
    for (const w of packed) {
      expect(w.x + w.w).toBeLessThanOrEqual(12);
    }
  });

  it("add / remove / swap / resize round-trip", () => {
    const base = defaultLayoutFor("viewer");
    const added = addWidget(base, "blockers");
    expect(added.widgets).toHaveLength(base.widgets.length + 1);
    const addedId = added.widgets[added.widgets.length - 1].id;
    const resized = resizeWidget(added, addedId, 6, 0);
    expect(resized.widgets.find((w) => w.id === addedId)?.w).toBe(12);
    const swapped = swapWidgets(resized, addedId, base.widgets[0].id);
    expect(swapped.widgets[0].id).toBe(addedId);
    const removed = removeWidget(swapped, addedId);
    expect(removed.widgets).toHaveLength(base.widgets.length);
    // Swap moved base[0] to the end, so removing the swapped-in widget
    // leaves the remaining widgets in swapped order, not base order.
    expect(removed.widgets.map((w) => w.id)).toEqual([
      ...base.widgets.slice(1).map((w) => w.id),
      base.widgets[0].id,
    ]);
  });
});

describe("widget registry", () => {
  it("registers exactly one component per widget type", () => {
    expect(Object.keys(WIDGET_REGISTRY).sort()).toEqual([...WIDGET_TYPES].sort());
    for (const def of Object.values(WIDGET_REGISTRY)) {
      expect(typeof def.component).toBe("function");
      expect(def.title.length).toBeGreaterThan(0);
    }
  });
});
