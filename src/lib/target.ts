// Which app this build is. Set per build in .env / .env.web / .env.preview.
//  desktop: the Tauri app on employees' PCs — no login, identified by their Windows account
//  web:     the browser app for the main admin and IT specialists — login required
//  preview: single-file demo with both, switchable, running on mock data
type Target = "desktop" | "web" | "preview";

export const TARGET = (import.meta.env.VITE_TARGET ?? "desktop") as Target;

/** Which of the two apps is on screen: the employee desktop app or the staff web app. */
export type AppKind = "desktop" | "web";

/** Build-time switches: the desktop build carries no staff screens (dashboard, queue, journal,
 *  report, login), the web build no employee screens (new request, my requests, device sign-in).
 *  Vite replaces VITE_TARGET with a literal, so the unused side is dropped from the bundle. */
export const HAS_STAFF = import.meta.env.VITE_TARGET !== "desktop" && import.meta.env.VITE_TARGET !== undefined;
export const HAS_EMPLOYEE = import.meta.env.VITE_TARGET !== "web";

export function appKind(previewAs: string): AppKind {
  if (!HAS_STAFF) return "desktop";
  if (!HAS_EMPLOYEE) return "web";
  return previewAs === "staff" ? "web" : "desktop";
}

/**
 * Demo data (the in-memory mock) exists only in dev (`npm run dev`, `tauri dev`), `dev:web:demo` and the
 * preview build. Production builds never fall back to it and don't carry it.
 */
export const DEMO_ALLOWED = import.meta.env.DEV || import.meta.env.VITE_DEMO === "1" || import.meta.env.VITE_TARGET === "preview";
