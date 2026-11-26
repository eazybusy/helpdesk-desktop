import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEMO_ALLOWED, TARGET } from "@/lib/target";
import type { User } from "@/lib/types";

export type Theme = "light" | "dark" | "system";

/** Which app the single-file preview is showing (preview build only). */
export type PreviewAs = "employee" | "staff";

interface SessionState {
  token: string | null;
  user: User | null;
  /** Web: keep the login across browser restarts ("დამახსოვრება"). */
  remember: boolean;
  /** Desktop: from the registry at start-up. Web: same origin or VITE_API_URL. */
  apiUrl: string;
  useMock: boolean;
  theme: Theme;
  notifications: boolean;
  previewAs: PreviewAs;
  setSession: (token: string, user: User, remember?: boolean) => void;
  logout: () => void;
  set: (patch: Partial<Pick<SessionState, "apiUrl" | "useMock" | "theme" | "notifications" | "previewAs">>) => void;
}

// A web login without "remember me" lives only as long as the browser tab.
const TAB_KEY = "hd-web-session";
function tabSession(): { token: string; user: User } | null {
  try {
    return JSON.parse(sessionStorage.getItem(TAB_KEY) ?? "null");
  } catch {
    return null;
  }
}
function setTabSession(v: { token: string; user: User } | null) {
  try {
    if (v) sessionStorage.setItem(TAB_KEY, JSON.stringify(v));
    else sessionStorage.removeItem(TAB_KEY);
  } catch {
    /* storage unavailable */
  }
}

const initialTab = TARGET === "web" ? tabSession() : null;

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: initialTab?.token ?? null,
      user: initialTab?.user ?? null,
      remember: false,
      apiUrl: TARGET === "web" ? (import.meta.env.VITE_API_URL ?? "") : "",
      // The web app talks to the real server, except `npm run dev:web:demo` (VITE_DEMO=1).
      useMock: DEMO_ALLOWED && (TARGET !== "web" || import.meta.env.VITE_DEMO === "1"),
      theme: "system",
      notifications: true,
      previewAs: "employee",
      setSession: (token, user, remember = false) => {
        if (TARGET === "web") setTabSession(remember ? null : { token, user });
        set({ token, user, remember });
      },
      logout: () => {
        setTabSession(null);
        set({ token: null, user: null, remember: false });
      },
      set: (patch) => set(patch),
    }),
    {
      name: "hd-session",
      storage: createJSONStorage(() => localStorage),
      // Only preferences are stored. A web login is stored only with "remember me";
      // the desktop session is re-created from the Windows account at every start.
      partialize: (s) => ({
        theme: s.theme,
        notifications: s.notifications,
        previewAs: s.previewAs,
        ...(TARGET === "web" && s.remember ? { token: s.token, user: s.user, remember: true } : {}),
      }),
      // Take back only what partialize writes. Older versions also stored apiUrl/useMock; restoring
      // those would e.g. switch `dev:web:demo` to the real server (ECONNREFUSED on /api/*).
      merge: (stored, current) => {
        const s = (stored ?? {}) as Partial<SessionState>;
        const keep: Partial<SessionState> = {};
        if (s.theme === "light" || s.theme === "dark" || s.theme === "system") keep.theme = s.theme;
        if (typeof s.notifications === "boolean") keep.notifications = s.notifications;
        if (s.previewAs === "employee" || s.previewAs === "staff") keep.previewAs = s.previewAs;
        if (TARGET === "web" && s.remember && s.token && s.user) Object.assign(keep, { token: s.token, user: s.user, remember: true });
        return { ...current, ...keep };
      },
    },
  ),
);

export const isStaff = (user: User | null) => user?.role === "agent" || user?.role === "admin";

/** Light/dark. Both apps use the "glass" look (index.css, html[data-skin="glass"]). */
export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.skin = "glass";
}
