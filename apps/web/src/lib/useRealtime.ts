import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getCurrentUser, getToken } from "./authFetch";
import { apiUrl, queryClient } from "./query-client";

export type RealtimeStatus = "live" | "connecting" | "offline";

export interface PresenceUser {
  userId: string;
  name?: string;
  ticketId?: string;
  boardId?: string;
  action?: "joined" | "left";
}

/**
 * useRealtime — Phase 2 (docs/REALTIME.md §3).
 *
 * One module-level socket (singleton: every component calling this hook
 * shares the connection). Connects with the stored JWT — the same token
 * apiFetch sends — joins the workspace room on connect, and joins a
 * ticket room on demand when a ticketId is passed.
 *
 * On ticket.* / daily_update.created / notification.created it
 * invalidates the matching TanStack Query keys so the board and
 * dashboard refresh live. When the socket is unavailable or drops,
 * nothing breaks: Phase 1 polling/refetch (dashboard refetchInterval,
 * refetch-on-focus, invalidation after mutations) remains the fallback
 * and the UI never goes blank.
 */
const LIVE_EVENTS = [
  "ticket.created",
  "ticket.updated",
  "ticket.status_changed",
  "daily_update.created",
  "notification.created",
] as const;

let socket: Socket | null = null;
let status: RealtimeStatus = "offline";
const statusListeners = new Set<(s: RealtimeStatus) => void>();

function setStatus(next: RealtimeStatus): void {
  if (status === next) return;
  status = next;
  for (const listener of statusListeners) listener(next);
}

/** Socket origin: the API base URL minus the /api/v1 prefix. */
export function socketUrl(): string {
  return apiUrl.replace(/\/api\/v1\/?$/, "");
}

function getOrCreateSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;
  if (socket) return socket;
  const next: Socket = io(socketUrl(), {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    transports: ["websocket", "polling"],
  });
  socket = next;
  setStatus("connecting");
  next.on("connect", () => setStatus("live"));
  next.on("disconnect", () => setStatus("offline"));
  next.on("connect_error", () => setStatus("offline"));
  for (const event of LIVE_EVENTS) {
    next.on(event, () => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }
  return next;
}

export function useRealtime(ticketId?: string): {
  status: RealtimeStatus;
  presence: PresenceUser[];
  typingUsers: PresenceUser[];
} {
  const [current, setCurrent] = useState<RealtimeStatus>(status);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const listener = (s: RealtimeStatus): void => setCurrent(s);
    statusListeners.add(listener);
    const s = getOrCreateSocket();
    if (s) setCurrent(s.connected ? "live" : "connecting");
    return () => {
      statusListeners.delete(listener);
    };
  }, []);

  // Join / leave the ticket room (and announce presence) while a ticket
  // is selected. Ephemeral only — the server keeps no presence state.
  useEffect(() => {
    const s = getOrCreateSocket();
    if (!s || !ticketId) {
      setPresence([]);
      return;
    }
    const user = getCurrentUser();
    s.emit("joinTicket", { ticketId });
    s.emit("presence.join", { ticketId, name: user?.name });
    const onPresence = (p: PresenceUser): void => {
      if (p.ticketId !== ticketId) return;
      setPresence((prev) => {
        const rest = prev.filter((u) => u.userId !== p.userId);
        return p.action === "left" ? rest : [...rest, p];
      });
    };
    const onTyping = (p: PresenceUser & { typing?: boolean }): void => {
      if (p.ticketId !== ticketId) return;
      setTypingUsers((prev) => {
        const rest = prev.filter((u) => u.userId !== p.userId);
        return p.typing ? [...rest, p] : rest;
      });
    };
    s.on("presence.updated", onPresence);
    s.on("typing", onTyping);
    return () => {
      s.off("presence.updated", onPresence);
      s.off("typing", onTyping);
      s.emit("presence.leave", { ticketId });
      s.emit("leaveTicket", { ticketId });
      setPresence([]);
      setTypingUsers([]);
    };
  }, [ticketId]);

  return { status: current, presence, typingUsers };
}
