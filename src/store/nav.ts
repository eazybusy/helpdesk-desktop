import { create } from "zustand";
import type { Origin, TicketScope } from "@/lib/types";

type View = "dashboard" | "queue" | "sla" | "report" | "journal" | "new" | "mine" | "settings";

interface NavState {
  view: View;
  scope: TicketScope;
  /** Admin queues: head office or regions (null = both). */
  origin: Origin | null;
  ticketId: number | null;
  paletteOpen: boolean;
  go: (view: View, opts?: { scope?: TicketScope; origin?: Origin | null; ticketId?: number | null }) => void;
  select: (id: number | null) => void;
  setScope: (scope: TicketScope) => void;
  setPalette: (open: boolean) => void;
}

export const useNav = create<NavState>((set) => ({
  view: "queue",
  scope: "all",
  origin: null,
  ticketId: null,
  paletteOpen: false,
  go: (view, opts) =>
    set((s) => ({
      view,
      scope: opts?.scope ?? s.scope,
      // A new scope without an origin means "both".
      origin: opts?.origin !== undefined ? opts.origin : opts?.scope ? null : s.origin,
      ticketId: opts?.ticketId !== undefined ? opts.ticketId : view === s.view ? s.ticketId : null,
    })),
  select: (ticketId) => set({ ticketId }),
  setScope: (scope) => set({ scope, ticketId: null }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
}));
