import { findIssues } from "@/lib/health";
import { LOG_CATEGORY } from "@/lib/labels";
import type {
  AttachedDevice,
  DeviceSnapshot,
  FileActivity,
  LogEvent,
  LogFlag,
  LogProblem,
  LogSession,
  LogSnapshot,
  SamSource,
  TicketCategory,
} from "@/lib/types";

// Demo data in the exact shape eventlog-pipeline returns (server/schemas.py).

const HOUR = 3_600_000;
const pad = (n: number) => String(n).padStart(2, "0");
/** "2026-11-04 14:32:10" in Asia/Tbilisi, like the pipeline's local_str(). */
const localStr = (t: number) => {
  const d = new Date(t + 4 * HOUR);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const hash = (str: string) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;

interface Rule { code: string; title: string; cat: string; severity: number; advice: string; min?: number }

interface Tpl {
  channel: string;
  provider: string;
  event_id: number;
  level: number;
  category: string;
  message: string;
  rule?: Rule;
}

const R: Record<string, Rule> = {
  DISK_FAILING: { code: "DISK_FAILING", title: "მყარი დისკის ხარვეზი (bad sector / I/O შეცდომა)", cat: "აპარატურა", severity: 1, advice: "დაუყოვნებლივ გააკეთე backup, შეამოწმე SMART და დაგეგმე დისკის შეცვლა." },
  SLOW_BOOT: { code: "SLOW_BOOT", title: "ნელი ჩატვირთვა / გამორთვა", cat: "წარმადობა", severity: 3, advice: "შეამოწმე autostart პროგრამები და დისკის მდგომარეობა.", min: 3 },
  LOW_MEMORY: { code: "LOW_MEMORY", title: "მეხსიერება ამოიწურა (RAM)", cat: "წარმადობა", severity: 2, advice: "ნახე რომელი პროცესი ჭამს მეხსიერებას; განიხილე RAM-ის გაზრდა." },
  UNEXPECTED_SHUTDOWN: { code: "UNEXPECTED_SHUTDOWN", title: "არაკორექტული გამორთვა / კვების პრობლემა", cat: "სისტემა", severity: 2, advice: "შეამოწმე კვების ბლოკი, UPS და დენის კაბელი; განმეორებადობისას — სადგურის შეცვლა." },
  DC_UNREACHABLE: { code: "DC_UNREACHABLE", title: "დომენის კონტროლერი მიუწვდომელია (Netlogon)", cat: "ქსელი/დომენი", severity: 2, advice: "შეამოწმე ქსელი, DNS-ის მისამართი და secure channel (Test-ComputerSecureChannel)." },
  DNS_TIMEOUT: { code: "DNS_TIMEOUT", title: "DNS არ პასუხობს (სახელების ამოხსნა ჩავარდა)", cat: "ქსელი/დომენი", severity: 3, advice: "შეამოწმე NIC-ის DNS პარამეტრები და DNS სერვისი DC-ზე.", min: 3 },
  TIME_SYNC: { code: "TIME_SYNC", title: "სისტემური დროის სინქრონიზაცია ჩავარდა (Kerberos რისკი)", cat: "ქსელი/დომენი", severity: 2, advice: "w32tm /resync /force; შეამოწმე NTP წყარო GPO-ში." },
  GPO_FAIL: { code: "GPO_FAIL", title: "ჯგუფური პოლიტიკა ვერ გამოიყენა", cat: "ქსელი/დომენი", severity: 3, advice: "gpupdate /force და gpresult /h; შეამოწმე SYSVOL-ზე წვდომა.", min: 2 },
  ACCOUNT_LOCKED: { code: "ACCOUNT_LOCKED", title: "მომხმარებლის ანგარიში დაიბლოკა", cat: "ავთენტიფიკაცია", severity: 2, advice: "განბლოკე ანგარიში და იპოვე წყარო (Caller Computer Name ლოგში)." },
  BAD_PASSWORD: { code: "BAD_PASSWORD", title: "არასწორი პაროლით შესვლის მცდელობები", cat: "ავთენტიფიკაცია", severity: 3, advice: "თუ ბევრია — შეამოწმე შენახული credential-ები, mapped drive-ები და მობილური მოწყობილობები.", min: 5 },
  APP_CRASH: { code: "APP_CRASH", title: "აპლიკაცია ავარიულად დაიხურა", cat: "აპლიკაცია", severity: 3, advice: "ნახე Faulting application name ლოგში; განიხილე პროგრამის განახლება/გადაყენება.", min: 2 },
  APP_HANG: { code: "APP_HANG", title: "აპლიკაცია გაითიშა (not responding)", cat: "აპლიკაცია", severity: 3, advice: "შეამოწმე ქსელური რესურსი/add-in, რომელსაც პროგრამა ელოდება.", min: 2 },
  OST_CORRUPT: { code: "OST_CORRUPT", title: "Outlook მონაცემთა ფაილის დაზიანება (OST/EDB)", cat: "აპლიკაცია", severity: 2, advice: "დაარქივე და ხელახლა ჩამოტვირთე OST, ან გაუშვი scanpst." },
  PRINT_FAIL: { code: "PRINT_FAIL", title: "ბეჭდვის პრობლემა (სპულერი/დრაივერი)", cat: "ბეჭდვა", severity: 3, advice: "გადატვირთე Print Spooler, გაასუფთავე რიგი და გადაამოწმე პრინტერის დრაივერი.", min: 2 },
  SERVICE_FAIL: { code: "SERVICE_FAIL", title: "სერვისი ვერ გაეშვა ან მოულოდნელად შეწყდა", cat: "სერვისი", severity: 3, advice: "ნახე სერვისის სახელი და დამოკიდებულებები; გადააყენე ავტომატურ გაშვებაზე.", min: 2 },
};

const POOLS: Record<TicketCategory, Tpl[]> = {
  software: [
    { channel: "Application", provider: "Application Error", event_id: 1000, level: 2, category: "app", rule: R.APP_CRASH, message: "Faulting application name: billing.exe, version: 4.2.1.0, faulting module name: ntdll.dll, exception code: 0xc0000374" },
    { channel: "Application", provider: "Application Hang", event_id: 1002, level: 2, category: "app", rule: R.APP_HANG, message: "The program billing.exe version 4.2.1.0 stopped interacting with Windows and was closed." },
    { channel: "System", provider: "Service Control Manager", event_id: 7031, level: 2, category: "system", rule: R.SERVICE_FAIL, message: "The 1C:Enterprise 8.3 Server Agent service terminated unexpectedly. It has done this 1 time(s)." },
  ],
  network: [
    { channel: "System", provider: "NETLOGON", event_id: 5719, level: 2, category: "network", rule: R.DC_UNREACHABLE, message: "This computer was not able to set up a secure session with a domain controller in domain WATER due to the following: There are currently no logon servers available." },
    { channel: "System", provider: "Microsoft-Windows-DNS-Client", event_id: 1014, level: 3, category: "network", rule: R.DNS_TIMEOUT, message: "Name resolution for the name water.local timed out after none of the configured DNS servers responded." },
    { channel: "System", provider: "Microsoft-Windows-Time-Service", event_id: 129, level: 3, category: "network", rule: R.TIME_SYNC, message: "NtpClient was unable to set a domain peer to use as a time source because of discovery error." },
    { channel: "Microsoft-Windows-GroupPolicy/Operational", provider: "Microsoft-Windows-GroupPolicy", event_id: 1058, level: 2, category: "network", rule: R.GPO_FAIL, message: "The processing of Group Policy failed. Windows attempted to read the file \\\\water.local\\SysVol\\water.local\\Policies\\{31B2F340-016D-11D2-945F-00C04FB984F9}\\gpt.ini from a domain controller and was not successful." },
  ],
  email: [
    { channel: "Application", provider: "Outlook", event_id: 455, level: 2, category: "app", rule: R.OST_CORRUPT, message: "Outlook data file C:\\Users\\mariam.lomidze\\AppData\\Local\\Microsoft\\Outlook\\mariam.lomidze@water.ge.ost could not be accessed." },
    { channel: "Application", provider: "Application Hang", event_id: 1002, level: 2, category: "app", rule: R.APP_HANG, message: "The program OUTLOOK.EXE version 16.0.17928.20156 stopped interacting with Windows and was closed." },
    { channel: "System", provider: "Microsoft-Windows-DNS-Client", event_id: 1014, level: 3, category: "network", rule: R.DNS_TIMEOUT, message: "Name resolution for the name outlook.office365.com timed out after none of the configured DNS servers responded." },
  ],
  printer: [
    { channel: "Microsoft-Windows-PrintService/Admin", provider: "Microsoft-Windows-PrintService", event_id: 372, level: 2, category: "print", rule: R.PRINT_FAIL, message: "The document ანგარიში_ოქტომბერი.xlsx, owned by user, failed to print on printer HP LaserJet M404 (3 სართ.). Win32 error code returned by the print processor: 0x00000709." },
    { channel: "Microsoft-Windows-PrintService/Admin", provider: "Microsoft-Windows-PrintService", event_id: 808, level: 2, category: "print", rule: R.PRINT_FAIL, message: "The print spooler failed to load a plug-in module C:\\Windows\\system32\\spool\\DRIVERS\\x64\\3\\hpcpp255.dll, error code 0x7e." },
    { channel: "System", provider: "Service Control Manager", event_id: 7031, level: 2, category: "system", rule: R.SERVICE_FAIL, message: "The Print Spooler service terminated unexpectedly. It has done this 2 time(s)." },
  ],
  hardware: [
    { channel: "System", provider: "disk", event_id: 153, level: 3, category: "hardware", rule: R.DISK_FAILING, message: "The IO operation at logical block address 0x2f1c8 for Disk 0 (PDO name: \\Device\\00000034) was retried." },
    { channel: "System", provider: "disk", event_id: 7, level: 2, category: "hardware", rule: R.DISK_FAILING, message: "The device, \\Device\\Harddisk0\\DR0, has a bad block." },
    { channel: "Microsoft-Windows-Diagnostics-Performance/Operational", provider: "Microsoft-Windows-Diagnostics-Performance", event_id: 100, level: 2, category: "performance", rule: R.SLOW_BOOT, message: "Windows has started up: Boot Duration: 318402ms, IsDegradation: true" },
    { channel: "System", provider: "Microsoft-Windows-Resource-Exhaustion-Detector", event_id: 2004, level: 3, category: "performance", rule: R.LOW_MEMORY, message: "Windows successfully diagnosed a low virtual memory condition. The following programs consumed the most virtual memory: chrome.exe (8412) consumed 2147483648 bytes." },
    { channel: "System", provider: "EventLog", event_id: 6008, level: 2, category: "hardware", rule: R.UNEXPECTED_SHUTDOWN, message: "The previous system shutdown at 08:41:12 on 03.11.2026 was unexpected." },
  ],
  access: [
    { channel: "Security", provider: "Microsoft-Windows-Security-Auditing", event_id: 4625, level: 0, category: "auth", rule: R.BAD_PASSWORD, message: "An account failed to log on. Failure Reason: Unknown user name or bad password. Logon Type: 2" },
    { channel: "Security", provider: "Microsoft-Windows-Security-Auditing", event_id: 4740, level: 0, category: "auth", rule: R.ACCOUNT_LOCKED, message: "A user account was locked out. Caller Computer Name: %HOST%" },
  ],
  other: [],
};

const COMMON: Tpl[] = [
  { channel: "Security", provider: "Microsoft-Windows-Security-Auditing", event_id: 4624, level: 0, category: "session", message: "An account was successfully logged on. Logon Type: 2" },
  { channel: "Security", provider: "Microsoft-Windows-Security-Auditing", event_id: 4634, level: 0, category: "session", message: "An account was logged off. Logon Type: 2" },
  { channel: "Microsoft-Windows-Kernel-PnP/Configuration", provider: "Microsoft-Windows-Kernel-PnP", event_id: 400, level: 4, category: "device", message: "Device HID\\VID_046D&PID_C534&MI_00\\7&2B8E5A7B&0&0000 was configured." },
  { channel: "System", provider: "Microsoft-Windows-DNS-Client", event_id: 1014, level: 3, category: "network", rule: R.DNS_TIMEOUT, message: "Name resolution for the name wpad.water.local timed out after none of the configured DNS servers responded." },
];

function makeEvents(sam: string, computer: string, category: TicketCategory, until: number, hours: number, n: number, extra?: "mass_delete" | "usb"): LogEvent[] {
  const r = rng(hash(sam + category + hours));
  const pool = [...POOLS[category], ...POOLS[category], ...POOLS[category], ...COMMON];
  const out: LogEvent[] = [];
  const sources: SamSource[] = ["event", "event", "session", "console"];
  for (let i = 0; i < n; i++) {
    const t = pool[Math.floor(r() * pool.length)];
    const when = until - Math.floor(r() * hours * HOUR);
    out.push({
      id: i + 1,
      computer,
      channel: t.channel,
      provider: t.provider,
      event_id: t.event_id,
      level: t.level,
      time_created: new Date(when).toISOString(),
      time_local: localStr(when),
      user_name: `WATER\\${sam}`,
      sam,
      sam_source: t.channel === "Security" ? "event" : sources[Math.floor(r() * sources.length)],
      category: t.category,
      category_label: LOG_CATEGORY[t.category] ?? t.category,
      object_name: null,
      device_id: t.category === "device" ? "HID\\VID_046D&PID_C534" : null,
      process_name: null,
      occurrences: r() > 0.85 ? 2 + Math.floor(r() * 4) : 1,
      message: t.message.replace("%HOST%", computer),
      data: null,
      problem_code: t.rule?.code ?? null,
      severity: t.rule?.severity ?? null,
    });
  }
  if (extra === "mass_delete") {
    const base = until - 5 * HOUR;
    const files = ["ბიუჯეტი_2026.xlsx", "ხელშეკრულება_მცხეთა.docx", "აბონენტები_ოქტომბერი.xlsx", "ინვოისი_1043.pdf", "აქტი_მრიცხველი_22.pdf"];
    for (let i = 0; i < 26; i++) {
      const when = base + i * 9000;
      out.push({
        id: n + i + 1, computer, channel: "Security", provider: "Microsoft-Windows-Security-Auditing", event_id: 4660, level: 0,
        time_created: new Date(when).toISOString(), time_local: localStr(when), user_name: `WATER\\${sam}`, sam, sam_source: "event",
        category: "file_delete", category_label: LOG_CATEGORY.file_delete,
        object_name: `\\\\fs01\\ბუღალტერია\\2026\\${i < files.length ? files[i] : `დოკუმენტი_${100 + i}.xlsx`}`,
        device_id: null, process_name: "C:\\Windows\\explorer.exe", occurrences: 1,
        message: "An object was deleted.", data: { AccessMask: "0x10000" }, problem_code: null, severity: null,
      });
    }
  }
  if (extra === "usb") {
    const when = until - 2 * HOUR;
    out.push({
      id: n + 100, computer, channel: "Security", provider: "Microsoft-Windows-Security-Auditing", event_id: 6416, level: 0,
      time_created: new Date(when).toISOString(), time_local: localStr(when), user_name: `WATER\\${sam}`, sam, sam_source: "session",
      category: "device", category_label: LOG_CATEGORY.device, object_name: null,
      device_id: "USBSTOR\\DISK&VEN_SANDISK&PROD_CRUZER_BLADE&REV_1.00\\4C530001230815117302", process_name: null, occurrences: 1,
      message: "A new external device was recognized by the system.", data: { ClassName: "DiskDrive" }, problem_code: null, severity: null,
    });
  }
  return out.sort((a, b) => b.time_created.localeCompare(a.time_created));
}

function problemsOf(events: LogEvent[]): LogProblem[] {
  const all = Object.values(R);
  const by = new Map<string, LogProblem>();
  for (const e of events) {
    if (!e.problem_code) continue;
    const rule = all.find((x) => x.code === e.problem_code)!;
    const p = by.get(rule.code) ?? {
      code: rule.code, title: rule.title, category: rule.cat, severity: rule.severity, advice: rule.advice,
      count: 0, first_seen: null, last_seen: null, computers: [], samples: [],
    };
    p.count += e.occurrences;
    if (!p.first_seen || e.time_created < p.first_seen) p.first_seen = e.time_created;
    if (!p.last_seen || e.time_created > p.last_seen) p.last_seen = e.time_created;
    if (!p.computers.includes(e.computer)) p.computers.push(e.computer);
    if (e.message && p.samples.length < 3 && !p.samples.includes(e.message)) p.samples.push(e.message);
    by.set(rule.code, p);
  }
  return [...by.values()]
    .filter((p) => p.count >= (all.find((x) => x.code === p.code)!.min ?? 1))
    .sort((a, b) => a.severity - b.severity || b.count - a.count)
    .slice(0, 8);
}

function activityOf(events: LogEvent[]) {
  const counts: Record<string, number> = {};
  const deleted: FileActivity[] = [];
  const transferred: FileActivity[] = [];
  const devices: AttachedDevice[] = [];
  for (const e of events) {
    const c = e.category ?? "other";
    counts[c] = (counts[c] ?? 0) + e.occurrences;
    const item: FileActivity = { time: e.time_created, time_local: e.time_local, sam: e.sam, computer: e.computer, object_name: e.object_name, process_name: e.process_name };
    if (c === "file_delete" && e.object_name) deleted.push(item);
    if (c === "file_transfer" && e.object_name) transferred.push(item);
    if (c === "device" && e.device_id && !devices.some((d) => d.device_id === e.device_id)) {
      const storage = /USBSTOR|DISK/i.test(e.device_id);
      devices.push({
        time: e.time_created, time_local: e.time_local, sam: e.sam, computer: e.computer, device_id: e.device_id,
        kind: storage ? "storage" : "peripheral",
        kind_label: storage ? "მონაცემთა მატარებელი (USB დისკი/ფლეშკა)" : "პერიფერია (კლავიატურა/მაუსი/აუდიო)",
        flagged: storage,
      });
    }
  }
  const flags: LogFlag[] = [];
  if (deleted.length >= 20)
    flags.push({ code: "MASS_DELETE", severity: 2, title: `ფაილების მასობრივი წაშლა (${deleted.length} ფაილი)`, advice: "გადაამოწმე, იყო ეს შეგნებული მოქმედება; საჭიროებისას აღადგინე backup-იდან." });
  const flagged = devices.filter((d) => d.flagged);
  if (flagged.length)
    flags.push({ code: "EXTERNAL_DEVICE", severity: 3, title: `გარე მოწყობილობა მიერთდა: ${[...new Set(flagged.map((d) => d.kind_label))].join(", ")}`, advice: "დაადასტურე, ნებადართულია თუ არა ეს მოწყობილობა ამ იუზერისთვის." });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    counts: Object.fromEntries(sorted),
    counts_labeled: Object.fromEntries(sorted.map(([k, v]) => [LOG_CATEGORY[k] ?? k, v])),
    deleted_files: deleted.slice(0, 50),
    transferred_files: transferred.slice(0, 50),
    devices,
    flags,
  };
}

export function makeLogSnapshot(sam: string, computer: string, category: TicketCategory, at: number, extra?: "mass_delete" | "usb"): LogSnapshot {
  const events = makeEvents(sam, computer, category, at, 24, 22 + (hash(sam) % 25), extra);
  const problems = problemsOf(events);
  const activity = activityOf(events);
  const parts: string[] = [];
  if (problems[0]) {
    parts.push(`სავარაუდო პრობლემა: ${problems[0].title} (${problems[0].count}-ჯერ)`);
    if (problems.length > 1) parts.push(`კიდევ ${problems.length - 1} მიმართულება`);
  }
  if (activity.flags.length) parts.push(activity.flags.slice(0, 2).map((f) => f.title).join("; "));
  const summary = parts.length ? parts.join(". ") + "." : `ბოლო 24 საათში კრიტიკული ლოგი არ დაფიქსირებულა (${events.length} ჩანაწერი).`;
  const text = [
    `EVENT LOG ამონაწერი — ${sam} (ბოლო 24 სთ)`,
    `მანქანა: ${computer}`,
    `აწყობილია: ${localStr(at)}`,
    "",
    ...(problems.length ? ["სავარაუდო პრობლემები:", ...problems.flatMap((p) => [`  • [${p.severity}] ${p.title} — ${p.count}-ჯერ`, `      რეკომენდაცია: ${p.advice}`]), ""] : []),
    ...(activity.flags.length ? ["გამაფრთხილებელი ნიშნები:", ...activity.flags.map((f) => `  ! ${f.title} — ${f.advice}`), ""] : []),
    `ლოგები (ბოლო ${Math.min(25, events.length)} / სულ ${events.length}):`,
    ...events.slice(0, 25).map((e) => `  ${e.time_local}  ${e.sam ?? "—"}  ${e.computer}  [${e.channel} / ${e.event_id}]  ${(e.message ?? "").slice(0, 160)}`),
  ].join("\n");
  return {
    sam, window_hours: 24, generated_at: new Date(at).toISOString(), generated_at_local: localStr(at),
    computers: [computer], problems, activity, events, summary, text,
  };
}

export function liveEvents(sam: string, computer: string, category: TicketCategory, hours: number, categories?: string[]) {
  const ev = makeEvents(sam, computer, category, Date.now(), hours, Math.min(900, Math.round(30 + hours * 1.4)));
  return categories?.length ? ev.filter((e) => categories.includes(e.category ?? "other")) : ev;
}

export function daySessions(sam: string, computer: string, hours: number): LogSession[] {
  const out: LogSession[] = [];
  const now = Date.now();
  const r = rng(hash(sam));
  for (let d = 0; d * 24 < hours; d++) {
    const day = new Date(now - d * 24 * HOUR);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const start = new Date(day).setHours(9, Math.floor(r() * 25), 0, 0);
    if (start > now) continue;
    const endT = new Date(day).setHours(18, Math.floor(r() * 30), 0, 0);
    const end = endT > now ? null : endT;
    out.push({
      computer, sam, user_name: `WATER\\${sam}`, logon_type: 2,
      start_time: new Date(start).toISOString(), end_time: end ? new Date(end).toISOString() : null,
      start_local: localStr(start), end_local: end ? localStr(end) : null,
    });
  }
  return out;
}

// ---- computer snapshots ----

type Raw = Omit<DeviceSnapshot, "issues" | "captured_at">;
const pdf = { name: "Microsoft Print to PDF", state: "ready", is_default: false, is_network: false, port: "PORTPROMPT:", driver: "Microsoft Print To PDF", jobs: 0, reachable: null, virtual: true } as const;

export const SNAPSHOTS: Record<string, Raw> = {
  slow: {
    cpu: { name: "Intel(R) Core(TM) i3-4160 CPU @ 3.60GHz", cores: 2, threads: 4, load_percent: 96 },
    memory: { total_gb: 3.9, used_gb: 3.7 },
    uptime_hours: 19 * 24 + 6,
    disks: [{ model: "ST500DM002-1BD142", media: "HDD", bus: "SATA", size_gb: 465.8, health: "Warning", wear_percent: null, temperature_c: null }],
    volumes: [{ letter: "C:", label: null, total_gb: 465.2, free_gb: 6.1 }],
    printers: [{ name: "Canon iR2520 (2 სართ.)", state: "ready", is_default: true, is_network: true, port: "10.10.2.31", driver: "Canon Generic Plus UFR II", jobs: 0, reachable: true, virtual: false }, pdf],
  },
  printer: {
    cpu: { name: "Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz", cores: 6, threads: 12, load_percent: 14 },
    memory: { total_gb: 15.8, used_gb: 7.2 },
    uptime_hours: 2 * 24 + 1,
    disks: [{ model: "Samsung SSD 980 500GB", media: "NVMe", bus: "NVMe", size_gb: 465.8, health: "Healthy", wear_percent: 4, temperature_c: 41 }],
    volumes: [{ letter: "C:", label: null, total_gb: 464.6, free_gb: 211.4 }],
    printers: [
      { name: "HP LaserJet M404 (3 სართ.)", state: "paper_jam", is_default: true, is_network: true, port: "10.10.3.40", driver: "HP Universal Printing PCL 6", jobs: 6, reachable: true, virtual: false },
      { name: "\\\\print01\\Canon-Color-2F", state: "offline", is_default: false, is_network: true, port: "\\\\print01\\Canon-Color-2F", driver: "Canon Generic Plus PCL6", jobs: 0, reachable: null, virtual: false },
      pdf,
    ],
  },
  healthy: {
    cpu: { name: "Intel(R) Core(TM) i5-12400 CPU", cores: 6, threads: 12, load_percent: 21 },
    memory: { total_gb: 15.8, used_gb: 9.1 },
    uptime_hours: 30,
    disks: [{ model: "KINGSTON SNV2S500G", media: "NVMe", bus: "NVMe", size_gb: 465.8, health: "Healthy", wear_percent: null, temperature_c: null }],
    volumes: [{ letter: "C:", label: null, total_gb: 464.6, free_gb: 188.3 }],
    printers: [{ name: "HP LaserJet M404 (3 სართ.)", state: "ready", is_default: true, is_network: true, port: "10.10.3.40", driver: "HP Universal Printing PCL 6", jobs: 0, reachable: true, virtual: false }, pdf],
  },
  regional: {
    cpu: { name: "Intel(R) Pentium(R) CPU G4560 @ 3.50GHz", cores: 2, threads: 4, load_percent: 47 },
    memory: { total_gb: 7.9, used_gb: 6.9 },
    uptime_hours: 8 * 24,
    disks: [
      { model: "KINGSTON SA400S37120G", media: "SSD", bus: "SATA", size_gb: 111.8, health: "Healthy", wear_percent: null, temperature_c: null },
      { model: "WDC WD10EZEX-08WN4A0", media: "HDD", bus: "SATA", size_gb: 931.5, health: "Healthy", wear_percent: null, temperature_c: null },
    ],
    volumes: [
      { letter: "C:", label: null, total_gb: 111.2, free_gb: 14.8 },
      { letter: "D:", label: "Data", total_gb: 931.4, free_gb: 602.0 },
    ],
    printers: [{ name: "Kyocera ECOSYS M2040dn", state: "low_toner", is_default: true, is_network: true, port: "192.168.20.15", driver: "Kyocera ECOSYS M2040dn KX", jobs: 1, reachable: false, virtual: false }, pdf],
  },
};

export const withIssues = (raw: Raw, at: number): DeviceSnapshot => ({ ...raw, captured_at: new Date(at).toISOString(), issues: findIssues(raw) });
