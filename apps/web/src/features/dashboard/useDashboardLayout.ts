import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboardLayout, resetDashboardLayout, saveDashboardLayout } from "./dashboardApi";
import {
  addWidget,
  pack,
  removeWidget,
  sortByPosition,
  updateWidgetConfig,
} from "./layoutOps";
import type {
  DashboardLayoutData,
  RoleTemplate,
  UiPrefs,
  WidgetConfig,
  WidgetPlacement,
  WidgetType,
} from "./types";

/**
 * Server-owned layout, cached locally (FRONTEND.md §1B/§4).
 * TanStack Query key ["dashboard-layout"]; the server record is the
 * source of truth, the local copy is optimistic only. Every change
 * auto-saves (debounced 600ms) via PUT /dashboard/layout.
 *
 * UI prefs (density, sidebar, visible nav) live in the layout's `ui`
 * block and sync across devices with it. They are exposed here for
 * the shell to consume; the Sidebar itself is owned by another slice
 * and does not read them yet (see HomePage / README).
 */
const LAYOUT_KEY = ["dashboard-layout"] as const;
const AUTOSAVE_MS = 600;

export function useDashboardLayout() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: LAYOUT_KEY,
    queryFn: () => fetchDashboardLayout(),
    retry: false,
  });
  const [layout, setLayoutState] = useState<DashboardLayoutData | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<DashboardLayoutData | null>(null);

  // Adopt the server layout when it first arrives (or after a reset).
  useEffect(() => {
    if (query.data) {
      setLayoutState({
        ...query.data.layout,
        widgets: pack(sortByPosition(query.data.layout.widgets)),
      });
    }
  }, [query.data]);

  // Flush any pending autosave when the page unloads, so a fast
  // navigation inside the debounce window does not drop the last edit.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pendingSave.current) void saveDashboardLayout(pendingSave.current);
    },
    [],
  );

  const saveMutation = useMutation({
    mutationFn: (next: DashboardLayoutData) => saveDashboardLayout(next),
    onError: () => {
      // Roll back to the last server state on failure.
      void queryClient.invalidateQueries({ queryKey: LAYOUT_KEY });
    },
  });

  const update = useCallback(
    (next: DashboardLayoutData) => {
      setLayoutState(next);
      queryClient.setQueryData(LAYOUT_KEY, (old: unknown) =>
        old && typeof old === "object" ? { ...(old as object), layout: next } : old,
      );
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingSave.current = next;
      saveTimer.current = setTimeout(() => {
        pendingSave.current = null;
        saveMutation.mutate(next);
      }, AUTOSAVE_MS);
    },
    [queryClient, saveMutation],
  );

  const resetMutation = useMutation({
    mutationFn: (template?: RoleTemplate) => resetDashboardLayout(template),
    onSuccess: (data) => {
      queryClient.setQueryData(LAYOUT_KEY, data);
      setLayoutState(data.layout);
    },
  });

  const effective: DashboardLayoutData | null = layout;

  return {
    layout: effective,
    isPending: query.isPending && !effective,
    isError: query.isError,
    isSaving: saveMutation.isPending,
    addWidget: useCallback(
      (type: WidgetType) => {
        if (effective) update(addWidget(effective, type));
      },
      [effective, update],
    ),
    removeWidget: useCallback(
      (id: string) => {
        if (effective) update(removeWidget(effective, id));
      },
      [effective, update],
    ),
    /**
     * Visibility toggle (Kanban fixed layout, locked 2026-11-19): show
     * or hide a whole widget type. One atomic save — toggling KPI on
     * adds all four KPI cards (velocity / done / at-risk / overdue)
     * that are missing, each with a unique id. Hiding the last
     * remaining widget is refused: the API requires >= 1 widget.
     * Stored x/y/w/h are ignored on render; the grid is fixed.
     */
    setWidgetVisible: useCallback(
      (type: WidgetType, visible: boolean) => {
        if (!effective) return;
        let next: DashboardLayoutData;
        if (visible) {
          if (type === "kpi") {
            const have = new Set(
              effective.widgets
                .filter((w) => w.type === "kpi")
                .map((w) => w.config.stat ?? "velocity"),
            );
            const missing = ["velocity", "done", "at-risk", "overdue"].filter(
              (s) => !have.has(s),
            );
            if (missing.length === 0) return;
            const stamp = Date.now().toString(36);
            const added: WidgetPlacement[] = missing.map((stat, i) => ({
              id: `kpi-${stat}-${stamp}-${i}`,
              type: "kpi" as const,
              x: 0,
              y: 0,
              w: 3,
              h: 1,
              config: { stat },
            }));
            next = { ...effective, widgets: pack([...effective.widgets, ...added]) };
          } else if (effective.widgets.some((w) => w.type === type)) {
            return;
          } else {
            next = addWidget(effective, type);
          }
        } else {
          const kept = effective.widgets.filter((w) => w.type !== type);
          if (kept.length === 0 || kept.length === effective.widgets.length) return;
          next = { ...effective, widgets: pack(kept) };
        }
        update(next);
      },
      [effective, update],
    ),
    updateWidgetConfig: useCallback(
      (id: string, config: WidgetConfig) => {
        if (effective) update(updateWidgetConfig(effective, id, config));
      },
      [effective, update],
    ),
    updateUi: useCallback(
      (patch: Partial<UiPrefs>) => {
        if (effective) update({ ...effective, ui: { ...effective.ui, ...patch } });
      },
      [effective, update],
    ),
    reset: useCallback(
      (template?: RoleTemplate) => resetMutation.mutate(template),
      [resetMutation],
    ),
    isResetting: resetMutation.isPending,
  };
}
