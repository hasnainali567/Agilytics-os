import { create } from "zustand";

/** Connections store — which providers this workspace has connected.
 *  State lives here until the Integrations API lands; the page already
 *  lists the Tier 1/2/3 catalog from docs/INTEGRATIONS.md. */
interface ConnectionsState {
  connected: Record<string, boolean>;
  toggle: (provider: string) => void;
}

export const useConnectionsStore = create<ConnectionsState>()((set) => ({
  connected: {},
  toggle: (provider) =>
    set((s) => ({ connected: { ...s.connected, [provider]: !s.connected[provider] } })),
}));
