import { PRINTER_STATE } from "./labels";
import type { DeviceSnapshot, Issue } from "./types";

// Rules for flagging problems in a computer snapshot. Thresholds are deliberately conservative:
// a flag should mean "worth a look", not "slightly above average".

export const pct = (used: number, total: number) => (total > 0 ? Math.round((used / total) * 100) : 0);

export function findIssues(s: Omit<DeviceSnapshot, "issues" | "captured_at">): Issue[] {
  const out: Issue[] = [];

  if (s.cpu.load_percent >= 90) out.push({ level: "warning", area: "cpu", text: `პროცესორი გადატვირთულია (${s.cpu.load_percent}%)` });

  const ram = pct(s.memory.used_gb, s.memory.total_gb);
  if (ram >= 90) out.push({ level: "error", area: "memory", text: `RAM თითქმის სავსეა (${ram}%)` });
  else if (ram >= 80) out.push({ level: "warning", area: "memory", text: `RAM დატვირთულია (${ram}%)` });
  if (s.memory.total_gb > 0 && s.memory.total_gb < 7.5) out.push({ level: "warning", area: "memory", text: `RAM მცირეა (${Math.round(s.memory.total_gb)} GB)` });

  for (const v of s.volumes) {
    const free = pct(v.free_gb, v.total_gb);
    if (free < 10 || v.free_gb < 5) out.push({ level: "error", area: "volume", text: `${v.letter} დისკზე ადგილი თითქმის არ არის (${v.free_gb.toFixed(1)} GB თავისუფალი)` });
    else if (free < 20) out.push({ level: "warning", area: "volume", text: `${v.letter} დისკზე ადგილი იწურება (${free}% თავისუფალი)` });
  }

  for (const d of s.disks) {
    if (d.health === "Unhealthy") out.push({ level: "error", area: "disk", text: `დისკი დაზიანებულია: ${d.model}` });
    else if (d.health === "Warning") out.push({ level: "warning", area: "disk", text: `დისკი გაფრთხილებას აჩვენებს: ${d.model}` });
    if (d.wear_percent != null && d.wear_percent >= 80) out.push({ level: "warning", area: "disk", text: `SSD ცვეთა ${d.wear_percent}%: ${d.model}` });
    if (d.temperature_c != null && d.temperature_c >= 60) out.push({ level: "warning", area: "disk", text: `დისკი ცხელდება (${d.temperature_c}°C): ${d.model}` });
  }

  if (s.uptime_hours >= 24 * 7) out.push({ level: "warning", area: "uptime", text: `კომპიუტერი ${Math.floor(s.uptime_hours / 24)} დღეა არ გადატვირთულა` });

  for (const p of s.printers) {
    if (p.virtual) continue;
    const bad = p.state !== "ready" && p.state !== "printing" && p.state !== "unknown";
    if (p.reachable === false) out.push({ level: "error", area: "printer", text: `${p.name}: ქსელში არ პასუხობს` });
    else if (bad) out.push({ level: p.is_default || p.state !== "offline" ? "error" : "warning", area: "printer", text: `${p.name}: ${PRINTER_STATE[p.state]}` });
    if (p.jobs >= 5) out.push({ level: "warning", area: "printer", text: `${p.name}: რიგში ${p.jobs} დოკუმენტი გაიჭედა` });
  }

  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
}
