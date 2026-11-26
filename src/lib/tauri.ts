import { DEMO_ALLOWED } from "@/lib/target";
import { useSession } from "@/store/session";
import { findIssues } from "./health";
import type { Device, DeviceSnapshot } from "./types";

// Thin wrappers so the UI also runs in a normal browser (preview, `npm run dev` without Tauri).

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function systemInfo(): Promise<Device> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<Device>("system_info");
  }
  if (DEMO_ALLOWED) {
    // Preview / plain browser: the demo employee.
    const { demoDeviceFor } = await import("@/api/mock");
    const me = useSession.getState().user?.username ?? "lasha.meskhi";
    return demoDeviceFor(me) ?? { hostname: "WTR-ACC-031", netbios: "WTR-ACC-031", username: me, domain: "WATER.LOCAL", ip: "10.10.4.200", os: "Windows 11 Pro 24H2" };
  }
  throw new Error("IT Support აპი მხოლოდ Windows-ის აპლიკაციიდან მუშაობს.");
}

interface DeviceConfig {
  api_url: string | null;
  device_key: string | null;
}

/** Desktop: ApiUrl / DeviceKey from HKLM\SOFTWARE\Policies\ITSupport (deployed by GPO). */
export async function deviceConfig(): Promise<DeviceConfig> {
  if (!isTauri()) return { api_url: null, device_key: null };
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DeviceConfig>("device_config");
}

/** This PC's RustDesk ID, or null when RustDesk isn't installed. */
export async function rustdeskId(): Promise<string | null> {
  if (!isTauri()) return "1482905316";
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("rustdesk_id").catch(() => null);
}

/**
 * Ask the SYSTEM task to set a one-time RustDesk password for this ticket and send it to the server.
 * The password never passes through the app (employees can't read it).
 */
export async function requestRemoteAccess(ticketId: number): Promise<boolean> {
  if (!isTauri()) return true;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("request_remote_access", { ticketId })
    .then(() => true)
    .catch((e) => {
      console.warn("remote access request failed", e);
      return false;
    });
}

/** CPU, RAM, disks, volumes, printers of this PC, with problems already flagged. */
export async function deviceSnapshot(): Promise<DeviceSnapshot> {
  let raw: Omit<DeviceSnapshot, "issues" | "captured_at">;
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    raw = await invoke("device_snapshot");
  } else {
    await new Promise((r) => setTimeout(r, 1200));
    raw = {
      cpu: { name: "Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz", cores: 6, threads: 12, load_percent: 23 },
      memory: { total_gb: 7.8, used_gb: 6.6 },
      uptime_hours: 9 * 24 + 3,
      disks: [
        { model: "KINGSTON SA400S37240G", media: "SSD", bus: "SATA", size_gb: 223.6, health: "Healthy", wear_percent: null, temperature_c: null },
        { model: "WDC WD10EZEX-08WN4A0", media: "HDD", bus: "SATA", size_gb: 931.5, health: "Healthy", wear_percent: null, temperature_c: null },
      ],
      volumes: [
        { letter: "C:", label: null, total_gb: 222.9, free_gb: 31.2 },
        { letter: "D:", label: "Data", total_gb: 931.4, free_gb: 412.7 },
      ],
      printers: [
        { name: "HP LaserJet M404 (3 სართ.)", state: "ready", is_default: true, is_network: true, port: "10.10.3.40", driver: "HP Universal Printing PCL 6", jobs: 0, reachable: true, virtual: false },
        { name: "Microsoft Print to PDF", state: "ready", is_default: false, is_network: false, port: "PORTPROMPT:", driver: "Microsoft Print To PDF", jobs: 0, reachable: null, virtual: true },
      ],
    };
  }
  return { ...raw, captured_at: new Date().toISOString(), issues: findIssues(raw) };
}

export async function notify(title: string, body: string) {
  if (!isTauri()) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission().catch(() => {});
    if (Notification.permission === "granted") new Notification(title, { body });
    return;
  }
  const n = await import("@tauri-apps/plugin-notification");
  let granted = await n.isPermissionGranted();
  if (!granted) granted = (await n.requestPermission()) === "granted";
  if (granted) n.sendNotification({ title, body });
}

async function win() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export const windowControls = {
  minimize: async () => isTauri() && (await win()).minimize(),
  toggleMaximize: async () => isTauri() && (await win()).toggleMaximize(),
  close: async () => isTauri() && (await win()).close(),
  isMaximized: async () => (isTauri() ? (await win()).isMaximized() : false),
  onResized: async (cb: () => void) => (isTauri() ? (await win()).onResized(cb) : () => {}),
};
