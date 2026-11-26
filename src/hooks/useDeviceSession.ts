import { useCallback, useEffect, useRef, useState } from "react";
import { api, deviceKeyRef } from "@/api";
import { DEMO_ALLOWED, TARGET } from "@/lib/target";
import { deviceConfig, systemInfo } from "@/lib/tauri";
import { useSession } from "@/store/session";

type BootState = { status: "connecting" } | { status: "ready" } | { status: "error"; message: string };

/**
 * Desktop app: no login screen. The Windows account (USERNAME + computer name) and the
 * device key that GPO put in the registry open an employee session on the server.
 * Runs again whenever the session is dropped (server restart, expired token → 401).
 */
export function useDeviceSession(enabled: boolean): { state: BootState; retry: () => void } {
  const user = useSession((s) => s.user);
  const [state, setState] = useState<BootState>({ status: "connecting" });
  const [attempt, setAttempt] = useState(0);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (user) {
      setState({ status: "ready" });
      return;
    }
    let cancelled = false;
    setState({ status: "connecting" });
    (async () => {
      // Don't hammer the server if sessions keep being rejected right after they are opened.
      const since = Date.now() - last.current;
      if (since < 5000) await new Promise((r) => setTimeout(r, 5000 - since));
      last.current = Date.now();
      try {
        if (TARGET === "desktop") {
          const cfg = await deviceConfig();
          deviceKeyRef.current = cfg.device_key;
          // ApiUrl from the registry (GPO), else the one built in (VITE_API_URL). Only dev builds fall back to demo data.
          const url = cfg.api_url || import.meta.env.VITE_API_URL || null;
          if (url) useSession.getState().set({ apiUrl: url.replace(/\/+$/, ""), useMock: false });
          else if (DEMO_ALLOWED) useSession.getState().set({ useMock: true });
          else throw new Error("ამ კომპიუტერზე IT Support-ის სერვერის მისამართი არ არის მითითებული (ApiUrl).");
        }
        const device = await systemInfo();
        const res = await api().deviceSession(device);
        if (cancelled) return;
        // The desktop app is the employee app, whatever the account's role on the web.
        useSession.getState().setSession(res.access_token, { ...res.user, role: "user" });
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "სერვერთან დაკავშირება ვერ მოხერხდა." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, user, attempt]);

  const retry = useCallback(() => {
    last.current = 0;
    setAttempt((a) => a + 1);
  }, []);
  return { state, retry };
}
