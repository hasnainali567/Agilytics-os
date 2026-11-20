import { isAuthenticated } from "../lib/authFetch";
import { useRealtime } from "../lib/useRealtime";

/**
 * Live indicator — subtle Kanban pill in the TopBar.
 * Green dot = live socket; amber = reconnecting; grey = offline
 * (polling fallback — the app still works). Hidden when logged out.
 */
export function LiveIndicator() {
  const { status } = useRealtime();
  if (!isAuthenticated()) return null;
  const dot =
    status === "live" ? "bg-done" : status === "connecting" ? "bg-warn" : "bg-muted";
  const label = status === "live" ? "Live" : status === "connecting" ? "Reconnecting" : "Offline";
  return (
    <span
      title={
        status === "live"
          ? "Live updates connected — the board refreshes as teammates work."
          : "Live updates offline — the board refreshes by polling instead."
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-page px-2.5 py-1 text-xs font-medium text-muted"
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
