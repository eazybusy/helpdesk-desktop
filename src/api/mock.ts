import { ASSIGNMENT_KINDS } from "@/lib/types";
import type {
  Agent,
  AuditEntry,
  Device,
  HistoryEntry,
  Stats,
  Ticket,
  TicketCategory,
  TicketDetail,
  TicketStatus,
  User,
  DeviceSnapshot,
  LogSnapshot,
  RemoteAccess,
  SlaPolicy,
  CannedReply,
  TicketComment,
} from "@/lib/types";
import { CATEGORY_ORDER, SLA_HOURS, regionFromHost } from "@/lib/labels";
import type { HelpDeskApi } from "./index";
import { ApiError } from "./http";
import { SNAPSHOTS, daySessions, liveEvents, makeLogSnapshot, withIssues } from "./mockLogs";
import { archiveFacts, buildReport, buildTeamReport, type Fact } from "./mockReport";

// In-memory demo backend. Follows the same rules API.md asks of the FastAPI server.

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = () => Date.now();
const iso = (t: number) => new Date(t).toISOString();
const wait = (ms = 120 + Math.random() * 220) => new Promise((r) => setTimeout(r, ms));

const users: User[] = [
  { id: 1, username: "tornike", full_name: "თორნიკე", role: "admin", department: "IT" },
  { id: 2, username: "nino.beridze", full_name: "ნინო ბერიძე", role: "agent", department: "IT" },
  { id: 3, username: "giorgi.kapanadze", full_name: "გიორგი კაპანაძე", role: "agent", department: "IT" },
  { id: 4, username: "sandro.maisuradze", full_name: "სანდრო მაისურაძე", role: "agent", department: "IT" },
  { id: 10, username: "lasha.meskhi", full_name: "ლაშა მესხი", role: "user", department: "ბუღალტერია" },
  { id: 11, username: "tamar.gelashvili", full_name: "თამარ გელაშვილი", role: "user", department: "აბონენტთა მომსახურება" },
  { id: 12, username: "davit.kvaratskhelia", full_name: "დავით კვარაცხელია", role: "user", department: "ტექნიკური სამსახური" },
  { id: 13, username: "mariam.lomidze", full_name: "მარიამ ლომიძე", role: "user", department: "იურიდიული" },
  { id: 14, username: "irakli.chkheidze", full_name: "ირაკლი ჩხეიძე", role: "user", department: "მრიცხველების განყოფილება" },
  { id: 20, username: "lasha.beradze", full_name: "ლაშა ბერაძე", role: "user", department: "მცხეთის სერვისცენტრი" },
  { id: 21, username: "levan.tsiklauri", full_name: "ლევან წიკლაური", role: "user", department: "გორის სერვისცენტრი" },
  { id: 22, username: "maka.jaoshvili", full_name: "მაკა ჯაოშვილი", role: "user", department: "თელავის სერვისცენტრი" },
];
const u = (id: number) => users.find((x) => x.id === id)!;

const dev = (hostname: string, username: string, ip: string, os = "Windows 11 Pro 24H2"): Device => ({
  hostname,
  netbios: hostname.slice(0, 15).toUpperCase(),
  username,
  domain: "WATER.LOCAL",
  ip,
  os,
});
const devices: Record<number, Device> = {
  10: dev("WTR-ACC-014", "lasha.meskhi", "10.10.4.37"),
  11: dev("WTR-CS-022", "tamar.gelashvili", "10.10.6.112", "Windows 11 Pro 23H2"),
  12: dev("WTR-TECH-003", "davit.kvaratskhelia", "10.10.8.19", "Windows 10 Pro 22H2"),
  13: dev("WTR-LAW-007", "mariam.lomidze", "10.10.5.64"),
  14: dev("WTR-MTR-011", "irakli.chkheidze", "10.10.9.41", "Windows 10 Pro 22H2"),
  20: dev("reg-mtskheta-lashaberadze", "lasha.beradze", "192.168.20.34", "Windows 10 Pro 22H2"),
  21: dev("reg-gori-levantsiklauri", "levan.tsiklauri", "192.168.30.12"),
  22: dev("reg-telavi-makajaoshvili", "maka.jaoshvili", "192.168.40.27"),
};

/** Browser preview only: pretend to be the demo user's own computer, so regional routing can be tried. */
export function demoDeviceFor(username: string): Device | null {
  const user = users.find((x) => x.username === username);
  return user ? (devices[user.id] ?? null) : null;
}

interface Seed {
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  requester: number;
  assignee: number | null;
  ageMin: number;
  pc: keyof typeof SNAPSHOTS;
  extra?: "mass_delete" | "usb";
  delegatedNote?: string;
}

const seeds: Seed[] = [
  { subject: "პრინტერი არ ბეჭდავს, ქვითრები რიგში გაიჭედა", description: "ქვითრის ბეჭდვაზე დაჭერის შემდეგ არაფერი ხდება. რიგში 6 დოკუმენტი დგას, აბონენტები გველოდებიან.", category: "printer", status: "new", requester: 11, assignee: null, ageMin: 9, pc: "printer" },
  { subject: "ბაზასთან კავშირი წყდება", description: "Billing პროგრამა ყოველ ნახევარ საათში წერს, რომ სერვერთან კავშირი დაიკარგა. ინტერნეტიც ნელია.", category: "network", status: "new", requester: 20, assignee: null, ageMin: 22, pc: "regional" },
  { subject: "საერთო საქაღალდიდან ფაილები გაქრა", description: "\\\\fs01\\ბუღალტერია\\2026 საქაღალდეში დღეს დილით ბევრი ფაილი აღარ ჩანს.", category: "other", status: "new", requester: 10, assignee: null, ageMin: 41, pc: "healthy", extra: "mass_delete" },
  { subject: "კომპიუტერი ძალიან ნელა მუშაობს", description: "ჩართვას 5-6 წუთი სჭირდება, პროგრამები იყინება. ზოგჯერ შავ ეკრანზე ჩერდება.", category: "hardware", status: "new", requester: 21, assignee: null, ageMin: 3 * 60, pc: "slow" },
  { subject: "ინტერნეტი წყდება ყოველ 10–15 წუთში", description: "მეორე სართულზე, მრიცხველების ოთახში, კავშირი ხშირად ქრება. ბოლო ორი დღეა ასეა.", category: "network", status: "open", requester: 14, assignee: 1, ageMin: 3 * 60 + 20, pc: "healthy" },
  { subject: "1C ბაზასთან დაკავშირების შეცდომა", description: "დილიდან 1C არ იხსნება, წერს „სერვერთან კავშირი ვერ მოხერხდა“. გუშინ ყველაფერი მუშაობდა.", category: "software", status: "open", requester: 22, assignee: 3, ageMin: 5 * 60, pc: "regional", delegatedNote: "სავარაუდოდ VPN ტუნელია, თელავის როუტერი შეამოწმე." },
  { subject: "Outlook-ში ფოსტა არ მოდის", description: "წერილები არ შემოდის 10:00-იდან. გაგზავნა მუშაობს.", category: "email", status: "open", requester: 13, assignee: 1, ageMin: 26 * 60, pc: "healthy" },
  { subject: "ანგარიში დაიბლოკა, პაროლი დამავიწყდა", description: "რამდენჯერმე არასწორად შევიყვანე პაროლი და ახლა ანგარიში დაბლოკილია.", category: "access", status: "new", requester: 12, assignee: null, ageMin: 24, pc: "healthy" },
  { subject: "Billing პროგრამა იყინება ანგარიშის ბეჭდვისას", description: "აბონენტის ანგარიშის ბეჭდვისას პროგრამა ჩერდება და მხოლოდ Task Manager-იდან ითიშება.", category: "software", status: "open", requester: 10, assignee: 2, ageMin: 7 * 60, pc: "healthy", extra: "usb" },
  { subject: "სკანერი არ ჩანს ქსელში", description: "Canon-ის სკანერი ვეღარ პოულობს კომპიუტერს, სკანირება საქაღალდეში ვერ ხდება.", category: "printer", status: "closed", requester: 11, assignee: 3, ageMin: 4 * 24 * 60, pc: "printer" },
  { subject: "მონიტორი ციმციმებს", description: "მარჯვენა მონიტორი პერიოდულად ქრება და ისევ ჩნდება.", category: "hardware", status: "closed", requester: 10, assignee: 1, ageMin: 6 * 24 * 60, pc: "healthy" },
];

// ---- store ----

interface Row extends Ticket {
  snapshot: DeviceSnapshot | null;
  remote: RemoteAccess | null;
  log_snapshot: LogSnapshot | null;
  history: HistoryEntry[];
  comments: TicketComment[];
}

/** Deadlines per category (ვადები). The server keeps this; new tickets get due_at from it. */
const sla: SlaPolicy = {
  hours: Object.fromEntries(CATEGORY_ORDER.map((c) => [c, SLA_HOURS])) as SlaPolicy["hours"],
  updated_at: null,
  updated_by: null,
};

let hid = 1;
let cid = 1;

/** A comment from IT: kept with the ticket and logged in its history (the journal shows it too). */
function comment(r: Row, author: User, body: string, at: number) {
  const c: TicketComment = { id: cid++, author, body, at: iso(at) };
  r.comments.push(c);
  r.comment_count = r.comments.length;
  r.last_comment = { author, body, at: c.at };
  r.history.push(H(at, author, "commented", { value: body.length > 140 ? `${body.slice(0, 139)}…` : body }));
  r.updated_at = c.at;
  return c;
}
const H = (at: number, actor: User | null, kind: HistoryEntry["kind"], rest: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: hid++,
  at: iso(at),
  actor,
  kind,
  ...rest,
});

/** Demo RustDesk ID per person (9 digits, as RustDesk shows them). */
const demoRustdeskId = (userId: number) => String(318_000_000 + userId * 7_919_113).slice(0, 9);
const demoPassword = () => Array.from({ length: 10 }, () => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 54)]).join("");

function rowFrom(
  id: number,
  s: Omit<Seed, "pc" | "ageMin"> & { created: number; device: Device; snapshot: DeviceSnapshot | null; extra?: Seed["extra"]; remoteId?: string | null },
): Row {
  const requester = u(s.requester);
  const region = regionFromHost(s.device.hostname);
  const assignee = s.assignee ? u(s.assignee) : null;
  const history: HistoryEntry[] = [H(s.created, requester, "created")];
  let delegated_by: User | null = null;
  if (assignee) {
    const at = s.created + 12 * MIN;
    if (region) {
      delegated_by = u(1);
      history.push(H(at, delegated_by, "delegated", { assignee, note: s.delegatedNote ?? null }));
    } else history.push(H(at, assignee, "taken", { assignee }));
    if (s.status !== "new" && s.status !== "open") history.push(H(at + 40 * MIN, assignee, "status", { value: s.status }));
  }
  const log = makeLogSnapshot(requester.username, s.device.netbios ?? s.device.hostname.toUpperCase(), s.category, s.created, s.extra);
  return {
    id,
    subject: s.subject,
    description: s.description,
    category: s.category,
    status: assignee && s.status === "new" ? "open" : s.status,
    requester,
    assignee,
    device: s.device,
    region,
    delegated_by,
    delegation_note: delegated_by ? (s.delegatedNote ?? null) : null,
    resolved_by: assignee && s.status === "closed" ? assignee : null,
    suspected_problem: log.summary,
    created_at: iso(s.created),
    updated_at: history[history.length - 1].at,
    due_at: iso(s.created + sla.hours[s.category] * HOUR),
    issue_count: s.snapshot?.issues.length ?? 0,
    comment_count: 0,
    last_comment: null,
    comments: [],
    snapshot: s.snapshot,
    // Seeds: ID and password already in place (the SYSTEM task ran when the ticket was opened).
    remote:
      s.remoteId === undefined
        ? { rustdesk_id: demoRustdeskId(s.requester), password: demoPassword(), updated_at: iso(s.created + 20_000) }
        : s.remoteId
          ? { rustdesk_id: s.remoteId, password: null, updated_at: null }
          : null,
    log_snapshot: log,
    history,
  };
}

const rows: Row[] = seeds.map((s, i) => {
  const created = now() - s.ageMin * MIN;
  return rowFrom(2040 + seeds.length - i, { ...s, created, device: devices[s.requester], snapshot: withIssues(SNAPSHOTS[s.pc], created) });
});
{
  // One answered ticket with a comment, so the employee's side shows what comments look like.
  const monitor = rows.find((r) => r.subject === "მონიტორი ციმციმებს");
  if (monitor) comment(monitor, u(1), "მონიტორის კაბელი შევცვალეთ. თუ ისევ დაიწყებს ციმციმს, გამოგზავნეთ ახალი მოთხოვნა.", Date.parse(monitor.created_at) + 55 * MIN);
}

/** The IT team's ready-made replies. {სახელი} and {ნომერი} are filled in when one is inserted. */
let rid = 1;
const replies: CannedReply[] = [
  ["არ ეხება IT-ს", "გამარჯობა, {სახელი}! ეს საკითხი IT სამსახურს არ ეხება. გთხოვთ, მიმართოთ შესაბამის სამსახურს. მოთხოვნა {ნომერი} დახურულია."],
  ["გადატვირთეთ კომპიუტერი", "{სახელი}, გთხოვთ, გადატვირთოთ კომპიუტერი და შეგვატყობინოთ, თუ პრობლემა ისევ გამეორდება."],
  ["დისტანციურად დაგიკავშირდებით", "{სახელი}, ახლა დისტანციურად დაგიკავშირდებით (RustDesk). გთხოვთ, კომპიუტერი არ გამორთოთ."],
  ["ცნობილი პრობლემაა", "პრობლემა ცნობილია და მასზე უკვე ვმუშაობთ. მოგვარებისთანავე შეგატყობინებთ."],
  ["მოგვარდა", "პრობლემა მოგვარებულია. თუ ისევ გამეორდება, გამოგზავნეთ ახალი მოთხოვნა."],
].map(([title, body]) => ({ id: rid++, title, body, author: u(1), updated_at: iso(now() - 3 * 24 * HOUR) }));

// ---- report history: a year of closed tickets that the lists don't show ----

/** More people/computers for the archive only (they never sign in to the demo). */
const archivePeople: { hostname: string; user: User }[] = [
  ["WTR-CS-031", "ეკა ნოზაძე", "აბონენტთა მომსახურება"],
  ["WTR-FIN-009", "ნათია ბერიშვილი", "ფინანსური"],
  ["WTR-HR-002", "ქეთევან მჭედლიძე", "HR"],
  ["WTR-TECH-011", "ზურაბ გოგიჩაიშვილი", "ტექნიკური სამსახური"],
  ["reg-kutaisi-teachanturia", "თეა ჭანტურია", "ქუთაისის სერვისცენტრი"],
  ["reg-zugdidi-ldarsalia", "ლაშა დარსალია", "ზუგდიდის სერვისცენტრი"],
  ["reg-akhaltsikhe-nberidze", "ნიკა ბერიძე", "ახალციხის სერვისცენტრი"],
  ["reg-sagarejo-mkapanadze", "მზია კაპანაძე", "საგარეჯოს სერვისცენტრი"],
].map(([hostname, full_name, department], i) => ({
  hostname,
  user: { id: 100 + i, username: hostname.toLowerCase(), full_name, role: "user" as const, department },
}));
let archive: Fact[] | null = null;

const factOf = (r: Row): Fact => {
  const at = (k: (h: HistoryEntry) => boolean) => {
    const h = r.history.find(k);
    return h ? Date.parse(h.at) : null;
  };
  const done = r.status === "closed";
  const fact: Fact = {
    id: r.id,
    created: Date.parse(r.created_at),
    first_response: at((h) => ["taken", "assigned", "delegated", "reassigned"].includes(h.kind)),
    resolved: done ? Date.parse(r.history.findLast((h) => h.kind === "status")?.at ?? r.updated_at) : null,
    due: r.due_at ? Date.parse(r.due_at) : Infinity,
    status: r.status,
    category: r.category,
    subject: r.subject,
    problem: r.suspected_problem,
    hostname: r.device.hostname,
    requester: r.requester,
    resolver: done ? (r.resolved_by ?? r.assignee) : null,
    moves: r.history
      .filter((h) => ASSIGNMENT_KINDS.includes(h.kind))
      .map((h) => ({ at: Date.parse(h.at), kind: h.kind, by: h.actor, to: h.assignee ?? null, from: h.from ?? null })),
  };
  return fact;
};

const isStaff = (x: User | null) => x?.role === "agent" || x?.role === "admin";
const isAdmin = (x: User | null) => x?.role === "admin";
const isActive = (r: Row) => r.status !== "closed";
/** Regional tickets nobody has been given yet: only admins see these. */
const awaitingDispatch = (r: Row) => !!r.region && !r.assignee && isActive(r);

/** Free = waiting in the shared queue for any IT specialist to take (regional ones go via the admin). */
const isFree = (r: Row) => !r.assignee && !r.region && isActive(r);

function visible(r: Row, viewer: User) {
  if (!isStaff(viewer)) return r.requester.id === viewer.id;
  if (isAdmin(viewer)) return true;
  // IT specialist: the free queue and their own tickets, nothing else.
  return isFree(r) || r.assignee?.id === viewer.id;
}

const summary = ({ snapshot: _s, log_snapshot: _l, history: _h, remote: _r, comments: _c, ...t }: Row, viewer: User): Ticket => ({
  ...t,
  suspected_problem: isStaff(viewer) ? t.suspected_problem : null,
  delegation_note: isStaff(viewer) ? t.delegation_note : null,
});

// One simulated incoming regional ticket shortly after start, so notifications and dispatch can be seen.
let simulated = false;
function maybeSimulate() {
  if (simulated || performance.now() < 45_000) return;
  simulated = true;
  const t = now();
  rows.unshift(
    rowFrom(Math.max(...rows.map((r) => r.id)) + 1, {
      subject: "მრიცხველების პროგრამა ვერ აგზავნის მონაცემებს",
      description: "დღის ჩვენებები ატვირთვისას წერს „Timeout“. სამი ცდა წარუმატებელი.",
      category: "software", status: "new", requester: 20, assignee: null,
      created: t, device: devices[20], snapshot: withIssues(SNAPSHOTS.regional, t),
    }),
  );
}

export function createMockApi(currentUser: () => User | null): HelpDeskApi {
  const me = () => {
    const x = currentUser();
    if (!x) throw new ApiError(401, "არ ხარ შესული.");
    return x;
  };
  const find = (id: number, viewer: User) => {
    const r = rows.find((x) => x.id === id);
    if (!r || !visible(r, viewer)) throw new ApiError(404, "მოთხოვნა ვერ მოიძებნა.");
    return r;
  };
  const touch = (r: Row) => (r.updated_at = iso(now()));
  const staffOnly = (v: User) => {
    if (!isStaff(v)) throw new ApiError(403, "მხოლოდ IT-სთვის.");
  };
  const checkTitle = (t: string) => {
    const x = t.trim();
    if (!x || x.length > 80) throw new ApiError(422, "სათაური სავალდებულოა (მაქს. 80 სიმბოლო).");
    return x;
  };
  const checkBody = (t: string) => {
    const x = t.trim();
    if (!x || x.length > 4000) throw new ApiError(422, "ტექსტი სავალდებულოა (მაქს. 4000 სიმბოლო).");
    return x;
  };
  /** Anyone in IT may add replies; only the author or the admin may change or remove one. */
  const ownReply = (id: number) => {
    const viewer = me();
    staffOnly(viewer);
    const x = replies.find((r) => r.id === id);
    if (!x) throw new ApiError(404, "მზა პასუხი ვერ მოიძებნა.");
    if (x.author.id !== viewer.id && !isAdmin(viewer)) throw new ApiError(403, "სხვის მზა პასუხს მხოლოდ მთავარი ადმინი ცვლის.");
    return x;
  };
  const rowForSam = (sam: string) => rows.find((r) => r.requester.username === sam);
  // The year of history behind the report and the deadlines page (built once, with the deadlines in force then).
  const allFacts = () => {
    archive ??= archiveFacts(
      users,
      [...Object.entries(devices).map(([id, d]) => ({ hostname: d.hostname, user: u(Number(id)) })), ...archivePeople],
      (c) => sla.hours[c],
    );
    return [...archive, ...rows.map(factOf)];
  };

  return {
    async login(email) {
      await wait(400);
      // Staff log in with their e-mail; the demo accepts any password.
      const name = email.trim().toLowerCase().split("@")[0];
      if (!name) throw new ApiError(400, "შეიყვანეთ ელ-ფოსტა.");
      const user = users.find((x) => x.username === name || x.username.split(".")[0] === name);
      if (!user) throw new ApiError(401, "ელ-ფოსტა ან პაროლი არასწორია.");
      if (!isStaff(user)) throw new ApiError(403, "ვებ-სისტემა მხოლოდ IT პერსონალისთვისაა. მოთხოვნა გააგზავნეთ IT Support აპლიკაციიდან.");
      return { access_token: `mock-${user.id}`, user };
    },

    async deviceSession(device) {
      await wait(250);
      const name = device.username.trim().toLowerCase();
      let user = users.find((x) => x.username === name);
      if (!user) {
        user = { id: 100 + users.length, username: name, full_name: name, role: "user", department: null };
        users.push(user);
      }
      // A device session is always an employee session, even on an IT person's own PC.
      return { access_token: `mock-device-${user.id}`, user: { ...user, role: "user" } };
    },

    async me() {
      await wait();
      return me();
    },

    async listTickets(query) {
      await wait();
      maybeSimulate();
      const viewer = me();
      const scope = query.scope ?? (isStaff(viewer) ? "all" : "requested");
      const q = query.q?.trim().toLowerCase();
      return rows
        .filter((r) => {
          if (!visible(r, viewer)) return false;
          const active = isActive(r);
          switch (scope) {
            case "closed": if (active || (!isAdmin(viewer) && isStaff(viewer) && r.assignee?.id !== viewer.id)) return false; break;
            case "requested": if (r.requester.id !== viewer.id) return false; break;
            case "dispatch": if (!awaitingDispatch(r)) return false; break;
            case "mine": if (!active || r.assignee?.id !== viewer.id) return false; break;
            case "unassigned": if (!isFree(r)) return false; break;
            case "all": if (!active || awaitingDispatch(r)) return false; break;
          }
          if (query.status && r.status !== query.status) return false;
          if (query.origin && (query.origin === "region") !== !!r.region) return false;
          if (query.region && r.region !== query.region) return false;
          if (q && !`${r.id} ${r.subject} ${r.requester.full_name} ${r.device.hostname}`.toLowerCase().includes(q)) return false;
          return true;
        })
        .map((r) => summary(r, viewer));
    },

    async getTicket(id) {
      await wait();
      const viewer = me();
      const r = find(id, viewer);
      const staff = isStaff(viewer);
      const detail: TicketDetail = {
        ...summary(r, viewer),
        snapshot: r.snapshot,
        log_snapshot: staff ? r.log_snapshot : null,
        // Copies: the demo store mutates these in place, and TanStack Query's structural sharing
        // would otherwise see "no change" and skip the re-render (e.g. when the password arrives).
        remote: staff && r.remote ? { ...r.remote } : null,
        // Requesters see who took the ticket, not the internal routing or notes.
        history: staff
          ? r.history.map((h) => ({ ...h }))
          : r.history.map((h) =>
              h.kind === "delegated" || h.kind === "reassigned" ? { ...h, kind: "assigned" as const, from: null, note: null }
              : h.kind === "returned" ? { ...h, kind: "unassigned" as const, from: null, note: null }
              : h,
            ),
        comments: r.comments.map((c) => ({ ...c })),
      };
      return detail;
    },

    async createTicket(data) {
      await wait(500);
      const viewer = me();
      const row = rowFrom(Math.max(...rows.map((r) => r.id)) + 1, {
        subject: data.subject, description: data.description, category: data.category,
        status: "new", requester: viewer.id, assignee: null, created: now(), device: data.device, snapshot: data.snapshot,
        remoteId: data.remote_id,
      });
      // In the demo the requester may be a fresh user not in the list above.
      row.requester = viewer;
      row.history[0].actor = viewer;
      rows.unshift(row);
      // Stand-in for deploy/RemoteAccess.ps1: the SYSTEM task sets a new password a few seconds later.
      if (row.remote?.rustdesk_id) {
        const remote = row.remote;
        setTimeout(() => {
          remote.password = demoPassword();
          remote.updated_at = iso(now());
        }, 3000);
      }
      // Demo only: if nobody touches it, an IT specialist takes the ticket and later solves it,
      // so the employee's "მუშავდება … მიერ" / "დასრულდა … მიერ" notifications can be seen.
      if (!row.region) {
        const nino = u(2);
        setTimeout(() => {
          if (row.assignee || row.status !== "new") return;
          row.assignee = nino;
          row.status = "open";
          row.updated_at = iso(now());
          row.history.push(H(now(), nino, "taken", { assignee: nino }));
          setTimeout(() => {
            if (row.assignee?.id === nino.id && row.status === "open")
              comment(row, nino, `${viewer.full_name.split(" ")[0]}, გთხოვთ, გადატვირთოთ კომპიუტერი და შეგვატყობინოთ, თუ პრობლემა ისევ გამეორდება.`, now());
          }, 20_000);
          setTimeout(() => {
            if (row.assignee?.id !== nino.id || row.status !== "open") return;
            row.status = "closed";
            row.resolved_by = nino;
            row.updated_at = iso(now());
            row.history.push(H(now(), nino, "status", { value: "closed" }));
          }, 60_000);
        }, 40_000);
      }
      return summary(row, viewer);
    },

    async updateTicket(id, patch) {
      await wait();
      const viewer = me();
      staffOnly(viewer);
      const r = find(id, viewer);
      if (!isAdmin(viewer)) {
        // IT specialist: take a free ticket, or move their own ticket between working states.
        const takes = patch.assignee_id === viewer.id && isFree(r);
        const ownStatus = r.assignee?.id === viewer.id && patch.status && ["open", "closed"].includes(patch.status);
        const other = patch.category || (patch.assignee_id !== undefined && !takes) || (patch.status && !ownStatus);
        if (other || (!takes && !ownStatus)) throw new ApiError(403, "ამ ცვლილების უფლება მხოლოდ მთავარ ადმინს აქვს.");
      }
      if (patch.status && patch.status !== r.status) {
        r.resolved_by = patch.status === "closed" ? viewer : null;
        r.status = patch.status;
        r.history.push(H(now(), viewer, "status", { value: patch.status }));
      }
      if (patch.category && patch.category !== r.category) {
        r.category = patch.category;
        // The deadline follows the category, counted from when the ticket was opened.
        r.due_at = iso(Date.parse(r.created_at) + sla.hours[r.category] * HOUR);
        r.history.push(H(now(), viewer, "category", { value: patch.category }));
      }
      if (patch.assignee_id !== undefined && patch.assignee_id !== (r.assignee?.id ?? null)) {
        const prev = r.assignee;
        const next = patch.assignee_id ? u(patch.assignee_id) : null;
        r.assignee = next;
        const kind = !next ? "unassigned" : prev ? "reassigned" : next.id === viewer.id ? "taken" : "assigned";
        r.history.push(H(now(), viewer, kind, { assignee: next, from: prev }));
        if (next && r.status === "new") r.status = "open";
      }
      touch(r);
      return summary(r, viewer);
    },

    async delegate(id, assigneeId, note) {
      await wait();
      const viewer = me();
      if (!isAdmin(viewer)) throw new ApiError(403, "დელეგირება მხოლოდ მთავარ ადმინს შეუძლია.");
      const r = find(id, viewer);
      const a = u(assigneeId);
      const prev = r.assignee;
      r.assignee = a;
      r.delegated_by = viewer;
      r.delegation_note = note.trim() || null;
      if (r.status === "new") r.status = "open";
      r.history.push(H(now(), viewer, "delegated", { assignee: a, from: prev, note: r.delegation_note }));
      touch(r);
      return summary(r, viewer);
    },

    async returnToDispatch(id, note) {
      await wait();
      const viewer = me();
      const r = find(id, viewer);
      if (r.assignee?.id !== viewer.id) throw new ApiError(403, "დაბრუნება მხოლოდ მინიჭებულ შემსრულებელს შეუძლია.");
      // Regional tickets go back to the admin's dispatch inbox, the rest to the free queue.
      r.assignee = null;
      r.status = "new";
      r.history.push(H(now(), viewer, "returned", { from: viewer, note: note.trim() || null }));
      touch(r);
      return summary(r, viewer);
    },

    async addComment(id, body) {
      await wait(200);
      const viewer = me();
      staffOnly(viewer);
      const r = find(id, viewer);
      const text = body.trim();
      if (!text) throw new ApiError(422, "კომენტარი ცარიელია.");
      if (text.length > 4000) throw new ApiError(422, "კომენტარი ძალიან გრძელია (მაქს. 4000 სიმბოლო).");
      return { ...comment(r, viewer, text, now()) };
    },

    async listReplies() {
      await wait();
      staffOnly(me());
      return replies.map((x) => ({ ...x })).sort((a, b) => a.title.localeCompare(b.title, "ka"));
    },

    async createReply({ title, body }) {
      await wait(200);
      const viewer = me();
      staffOnly(viewer);
      const x: CannedReply = { id: rid++, title: checkTitle(title), body: checkBody(body), author: viewer, updated_at: iso(now()) };
      replies.push(x);
      return { ...x };
    },

    async updateReply(id, { title, body }) {
      await wait(200);
      const x = ownReply(id);
      x.title = checkTitle(title);
      x.body = checkBody(body);
      x.updated_at = iso(now());
      return { ...x };
    },

    async deleteReply(id) {
      await wait(200);
      const x = ownReply(id);
      replies.splice(replies.indexOf(x), 1);
    },

    async listAudit(query) {
      await wait();
      if (!isAdmin(me())) throw new ApiError(403, "ჟურნალი მხოლოდ მთავარი ადმინისთვისაა.");
      const since = query.since ? Date.parse(query.since) : -Infinity;
      const q = query.q?.trim().toLowerCase().replace(/^#/, "");
      const all: AuditEntry[] = rows.flatMap((r) =>
        r.history.map((h) => ({
          id: h.id,
          at: h.at,
          actor: h.actor,
          action: h.kind,
          ticket: { id: r.id, subject: r.subject, region: r.region },
          from: h.from ?? null,
          to: h.assignee ?? null,
          value: h.value ?? null,
          note: h.note ?? null,
          ip: h.kind === "created" ? r.device.ip ?? null : h.actor ? `10.10.1.${20 + (h.actor.id % 40)}` : null,
          client: h.kind === "created" ? "desktop" : "web",
        })),
      );
      return all
        .filter((e) => (query.action === "assignment" ? ASSIGNMENT_KINDS.includes(e.action) : !query.action || e.action === query.action))
        .filter((e) => !query.person_id || [e.actor?.id, e.from?.id, e.to?.id].includes(query.person_id))
        .filter((e) => Date.parse(e.at) >= since)
        .filter((e) => !q || String(e.ticket.id) === q || e.ticket.subject.toLowerCase().includes(q))
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id)
        .slice(0, query.limit ?? 500);
    },

    async report(query) {
      await wait(250);
      if (!isAdmin(me())) throw new ApiError(403, "რეპორტი მხოლოდ მთავარი ადმინისთვისაა.");
      return buildReport(allFacts(), query);
    },

    async slaPolicy() {
      await wait();
      staffOnly(me());
      return structuredClone(sla);
    },

    async setSlaPolicy(hours) {
      await wait(250);
      const viewer = me();
      if (!isAdmin(viewer)) throw new ApiError(403, "ვადებს მხოლოდ მთავარი ადმინი ცვლის.");
      for (const c of CATEGORY_ORDER) {
        const h = hours[c];
        if (!Number.isFinite(h) || h < 1 || h > 720) throw new ApiError(422, "ვადა 1-დან 720 საათამდე უნდა იყოს.");
      }
      sla.hours = { ...hours };
      sla.updated_at = iso(now());
      sla.updated_by = viewer;
      return structuredClone(sla);
    },

    async teamReport(query) {
      await wait(200);
      if (!isAdmin(me())) throw new ApiError(403, "მხოლოდ მთავარი ადმინისთვის.");
      return buildTeamReport(allFacts(), query);
    },

    async listAgents() {
      await wait();
      if (!isAdmin(me())) throw new ApiError(403, "მხოლოდ მთავარი ადმინისთვის.");
      return users.filter(isStaff).map<Agent>((a) => ({ ...a, active_count: rows.filter((r) => isActive(r) && r.assignee?.id === a.id).length }));
    },

    async stats() {
      await wait();
      maybeSimulate();
      const viewer = me();
      const t = now();
      const admin = isAdmin(viewer);
      const mine = rows.filter((r) => visible(r, viewer));
      const active = mine.filter((r) => isActive(r) && !awaitingDispatch(r));
      const day = (d: number) => new Date(d).toISOString().slice(0, 10);
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      const regions = new Map<string, number>();
      for (const r of mine.filter(isActive)) if (r.region) regions.set(r.region, (regions.get(r.region) ?? 0) + 1);
      const daily: Stats["daily"] = [];
      for (let i = 13; i >= 0; i--) {
        const d = day(t - i * 24 * HOUR);
        const created = mine.filter((r) => day(Date.parse(r.created_at)) === d).length;
        const base = Math.round(4 + 3 * Math.sin(i * 1.3) + (i % 7 === 0 || i % 7 === 6 ? -3 : 0));
        daily.push({ date: d, created: created + Math.max(0, base), resolved: Math.max(0, base + (i % 3) - 1) });
      }
      return {
        new: active.filter((r) => r.status === "new").length,
        open: active.filter((r) => r.status === "open").length,
        overdue: mine.filter((r) => isActive(r) && r.due_at && Date.parse(r.due_at) < t).length,
        resolved_today: mine.filter((r) => r.status === "closed" && Date.parse(r.updated_at) >= startOfToday).length + (admin ? 3 : 1),
        mine: active.filter((r) => r.assignee?.id === viewer.id).length,
        unassigned: rows.filter(isFree).length,
        dispatch: isAdmin(viewer) ? rows.filter(awaitingDispatch).length : 0,
        avg_first_response_minutes: admin ? 23 : 18,
        team: admin
          ? users.filter(isStaff).map((agent) => {
              const own = rows.filter((r) => isActive(r) && r.assignee?.id === agent.id);
              const closedToday = rows.filter((r) => r.status === "closed" && r.resolved_by?.id === agent.id && Date.parse(r.updated_at) >= startOfToday).length;
              // Demo: the three extra "resolved today" above belong to the IT specialists, one each.
              return { agent, active: own.length, overdue: own.filter((r) => r.due_at && Date.parse(r.due_at) < t).length, closed_today: closedToday + (agent.role === "agent" ? 1 : 0) };
            })
          : [],
        by_origin: {
          hq: mine.filter((r) => isActive(r) && !r.region).length,
          region: mine.filter((r) => isActive(r) && !!r.region).length,
        },
        by_region: [...regions].map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count),
        daily,
      };
    },

    async userEvents(sam, hours, categories) {
      await wait(300);
      staffOnly(me());
      const r = rowForSam(sam);
      return liveEvents(sam, r?.device.netbios ?? "UNKNOWN", r?.category ?? "other", hours, categories);
    },

    async userDay(sam, date) {
      await wait(300);
      staffOnly(me());
      const r = rowForSam(sam);
      const start = new Date(`${date}T00:00:00+04:00`).getTime();
      const all = liveEvents(sam, r?.device.netbios ?? "UNKNOWN", r?.category ?? "other", 24 * 30);
      const events = all.filter((e) => {
        const t = Date.parse(e.time_created);
        return t >= start && t < start + 24 * HOUR;
      }).reverse();
      return { events, total_events: events.length };
    },

    async userSessions(sam, hours) {
      await wait();
      staffOnly(me());
      const r = rowForSam(sam);
      return daySessions(sam, r?.device.netbios ?? "UNKNOWN", hours);
    },
  };
}
