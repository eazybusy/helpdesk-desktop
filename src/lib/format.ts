// Georgian date formatting done by hand: WebView/ICU builds don't all ship "ka" locale data,
// and a fallback to English mid-sentence looks broken.

const MONTHS = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];
const pad = (n: number) => String(n).padStart(2, "0");

export function relative(isoDate: string, now = Date.now()) {
  const d = new Date(isoDate);
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 45) return "ახლახან";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} წთ წინ`;
  if (s < 86400) return `${Math.round(s / 3600)} სთ წინ`;
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(isoDate).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 1) return "გუშინ";
  if (days < 7) return `${days} დღის წინ`;
  return shortDate(isoDate);
}

export const shortDate = (isoDate: string) => {
  const d = new Date(isoDate);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const hm = (isoDate: string) => {
  const d = new Date(isoDate);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** Today as YYYY-MM-DD in local time (toISOString() would give the UTC date: yesterday before 04:00 in Tbilisi). */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateTime = (isoDate: string) => `${shortDate(isoDate)}, ${hm(isoDate)}`;

/** "2 სთ 15 წთ" style duration. */
export function duration(ms: number) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 60) return `${m} წთ`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} სთ ${m % 60} წთ` : `${h} სთ`;
  return `${Math.floor(h / 24)} დღე`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export const ticketNo = (id: number) => `#${id}`;

/** Numeric RustDesk IDs in groups of three, easier to read out over the phone. */
export function rustdeskLabel(id: string) {
  // Same grouping as RustDesk's own window: from the right ("1 482 905 316").
  return /^\d+$/.test(id) ? id.replace(/\B(?=(\d{3})+$)/g, " ") : id;
}

/**
 * Georgian genitive of a person's name, for "… მიერ": declines the last word.
 * თორნიკე → თორნიკეს, ნინო ბერიძე → ნინო ბერიძის, თორნიკე ხარაზიშვილი → თორნიკე ხარაზიშვილის,
 * დავით კვარაცხელია → დავით კვარაცხელიას, დავით → დავითის.
 */
export function genitive(name: string) {
  const words = name.trim().split(/\s+/);
  const last = words.pop() ?? "";
  const single = words.length === 0;
  let g: string;
  if (/[იაოუ]$/.test(last)) g = `${last}ს`;
  else if (/ე$/.test(last)) g = single ? `${last}ს` : `${last.slice(0, -1)}ის`; // surname -ძე → -ძის, a first name keeps ე
  else g = `${last}ის`;
  return [...words, g].join(" ");
}

/** Report and deadline periods, in days. */
export type Period = "1" | "7" | "30" | "90" | "365";
export const PERIOD_LABEL: Record<Period, string> = { "1": "დღეს", "7": "7 დღე", "30": "30 დღე", "90": "3 თვე", "365": "12 თვე" };

/** Start of the day `days - 1` days ago, so "7 days" is today and the six before it. Stable for the whole day. */
export function periodStart(days: number, today: string) {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - days + 1);
  return d.toISOString();
}
