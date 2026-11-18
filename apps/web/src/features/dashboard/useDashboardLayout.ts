import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboardLayout, resetDashboardLayout, saveDashboardLayout } from "./dashboardApi";
import {
  addWidget,
  moveWidget,
  pack,
  removeWidget,
  resizeWidget,
  sortByPosition,
  swapWidgets,
  updateWidgetConfig,
} from "./layoutOps";
import { defaultLayoutFor } from "./templates";
import type { DashboardLayoutData, RoleTemplate, UiPrefs, WidgetConfig, WidgetType } from "./types";

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

  const applyTemplate = useCallback(
    (template: RoleTemplate) => update(defaultLayoutFor(template)),
    [update],
  );

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
    swapWidgets: useCallback(
      (idA: string, idB: string) => {
        if (effective) update(swapWidgets(effective, idA, idB));
      },
      [effective, update],
    ),
    moveWidget: useCallback(
      (id: string, direction: -1 | 1) => {
        if (effective) update(moveWidget(effective, id, direction));
      },
      [effective, update],
    ),
    resizeWidget: useCallback(
      (id: string, dw: number, dh: number) => {
        if (effective) update(resizeWidget(effective, id, dw, dh));
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
    applyTemplate,
    reset: useCallback(
      (template?: RoleTemplate) => resetMutation.mutate(template),
      [resetMutation],
    ),
    isResetting: resetMutation.isPending,
  };
}
