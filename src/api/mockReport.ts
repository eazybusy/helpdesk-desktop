// Demo only: a year of closed tickets for the admin report, and the report itself computed the way
// API.md asks the server to (over every ticket, not only the ones in the lists).

import { regionFromHost } from "@/lib/labels";
import type { Handoffs, HistoryKind, Report, ReportQuery, TeamReport, TicketCategory, TicketStatus, User } from "@/lib/types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** One change of holder (ticket_history rows of the assignment kinds). */
export interface Move {
  at: number;
  kind: HistoryKind;
  by: User | null;
  to: User | null;
  from: User | null;
}

/** One ticket reduced to what the report needs. */
export interface Fact {
  id: number;
  created: number;
  first_response: number | null;
  resolved: number | null;
  /** The deadline the ticket got when it was opened (due_at). */
  due: number;
  status: TicketStatus;
  category: TicketCategory;
  subject: string;
  problem: string | null;
  hostname: string;
  requester: User | null;
  resolver: User | null;
  moves: Move[];
}

/** "სავარაუდო პრობლემა: X (20-ჯერ). კიდევ 2…" → "X", so the same problem groups together. */
function problemKey(summary: string | null): string | null {
  if (!summary) return null;
  const s = summary.replace(/^სავარაუდო პრობლემა:\s*/, "").split(/\s*[(.]/)[0].trim();
  return s || null;
}

/** Subjects written by people: same words, different case/punctuation → one group. */
const subjectKey = (s: string) => s.toLowerCase().replace(/[.,!?;:"'„“«»()\-–]/g, " ").replace(/\s+/g, " ").trim();

// ---- a year of history -------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What people ask for, how often (weight) and what the Event Log usually finds. */
const KINDS: { category: TicketCategory; subject: string; problem: string | null; w: number; fixMin: number }[] = [
  { category: "printer", subject: "პრინტერი არ ბეჭდავს", problem: "ბეჭდვის რიგი გაჭედილია (Print Spooler)", w: 14, fixMin: 35 },
  { category: "printer", subject: "პრინტერში ქაღალდი იჭედება", problem: null, w: 6, fixMin: 50 },
  { category: "printer", subject: "სკანერი საქაღალდეში ვერ ინახავს", problem: "საერთო საქაღალდეზე წვდომა უარყოფილია", w: 5, fixMin: 40 },
  { category: "access", subject: "ანგარიში დაიბლოკა", problem: "ანგარიში დაიბლოკა არასწორი პაროლის გამო", w: 12, fixMin: 10 },
  { category: "access", subject: "პაროლის აღდგენა", problem: null, w: 7, fixMin: 12 },
  { category: "access", subject: "საქაღალდეზე წვდომა არ მაქვს", problem: "საერთო საქაღალდეზე წვდომა უარყოფილია", w: 5, fixMin: 25 },
  { category: "software", subject: "Billing პროგრამა ითიშება", problem: "აპლიკაცია ავარიულად დაიხურა", w: 10, fixMin: 90 },
  { category: "software", subject: "1C ბაზასთან დაკავშირების შეცდომა", problem: "SQL სერვერთან კავშირის დროის ამოწურვა", w: 6, fixMin: 70 },
  { category: "software", subject: "Office-ის გააქტიურება", problem: null, w: 4, fixMin: 20 },
  { category: "software", subject: "Windows-ის განახლება ვერ ყენდება", problem: "Windows Update-ის შეცდომა 0x80070643", w: 3, fixMin: 120 },
  { category: "network", subject: "ინტერნეტი ნელია", problem: "DNS სერვერი გვიან პასუხობს", w: 8, fixMin: 60 },
  { category: "network", subject: "საერთო საქაღალდე არ იხსნება", problem: "ქსელური დისკი გათიშულია", w: 7, fixMin: 30 },
  { category: "network", subject: "ბაზასთან კავშირი წყდება", problem: "სისტემური დროის სინქრონიზაცია ჩავარდა (Kerberos)", w: 5, fixMin: 80 },
  { category: "network", subject: "VPN არ უკავშირდება", problem: "VPN ტუნელი ვერ დამყარდა", w: 4, fixMin: 75 },
  { category: "email", subject: "Outlook წერილებს არ აგზავნის", problem: "Outlook-ის პროფილი დაზიანებულია", w: 6, fixMin: 45 },
  { category: "email", subject: "საფოსტო ყუთი გადავსებულია", problem: null, w: 4, fixMin: 25 },
  { category: "hardware", subject: "კომპიუტერი ძალიან ნელა მუშაობს", problem: "ოპერატიული მეხსიერება გადატვირთულია", w: 8, fixMin: 100 },
  { category: "hardware", subject: "C: დისკზე ადგილი აღარ არის", problem: "დისკზე თავისუფალი ადგილი 10%-ზე ნაკლებია", w: 5, fixMin: 40 },
  { category: "hardware", subject: "კომპიუტერი თავისით გადაიტვირთება", problem: "მოულოდნელი გამორთვა (Kernel-Power 41)", w: 3, fixMin: 240 },
  { category: "hardware", subject: "მონიტორი ციმციმებს", problem: null, w: 3, fixMin: 60 },
  { category: "other", subject: "ახალი თანამშრომლის სამუშაო ადგილი", problem: null, w: 4, fixMin: 300 },
];

export function archiveFacts(users: User[], hosts: { hostname: string; user: User }[], hoursOf: (c: TicketCategory) => number): Fact[] {
  const rnd = mulberry32(20261109);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const total = KINDS.reduce((n, k) => n + k.w, 0);
  const kind = () => {
    let x = rnd() * total;
    for (const k of KINDS) if ((x -= k.w) < 0) return k;
    return KINDS[0];
  };
  const agents = users.filter((u) => u.role === "agent");
  const admin = users.find((u) => u.role === "admin") ?? null;
  const hq = hosts.filter((h) => !regionFromHost(h.hostname));
  const reg = hosts.filter((h) => regionFromHost(h.hostname));

  const out: Fact[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Who held each ticket on the way: its own random stream, so the rest of the history stays the same.
  const rnd2 = mulberry32(4242);
  const other = (x: User | null) => {
    const xs = agents.filter((a) => a.id !== x?.id);
    return xs[Math.floor(rnd2() * xs.length)];
  };
  const movesFor = (first: number, resolved: number, regional: boolean, resolver: User | null): Move[] => {
    if (!resolver) return [];
    const at = (f: number) => first + (resolved - first) * f;
    const r = rnd2();
    if (regional) {
      // Regional tickets always go through the admin.
      if (r < 0.08) {
        const x = other(resolver);
        return [{ at: first, kind: "delegated", by: admin, to: x, from: null }, { at: at(0.35), kind: "reassigned", by: admin, to: resolver, from: x }];
      }
      if (r < 0.11) {
        const x = other(resolver);
        return [
          { at: first, kind: "delegated", by: admin, to: resolver, from: null },
          { at: at(0.25), kind: "reassigned", by: admin, to: x, from: resolver },
          { at: at(0.55), kind: "reassigned", by: admin, to: resolver, from: x },
        ];
      }
      return [{ at: first, kind: "delegated", by: admin, to: resolver, from: null }];
    }
    if (resolver.role === "admin") return [{ at: first, kind: "taken", by: resolver, to: resolver, from: null }];
    if (r < 0.07) {
      const x = other(resolver);
      return [{ at: first, kind: "assigned", by: admin, to: x, from: null }, { at: at(0.4), kind: "reassigned", by: admin, to: resolver, from: x }];
    }
    if (r < 0.1) {
      const x = other(resolver);
      return [
        { at: first, kind: "assigned", by: admin, to: resolver, from: null },
        { at: at(0.3), kind: "reassigned", by: admin, to: x, from: resolver },
        { at: at(0.6), kind: "reassigned", by: admin, to: resolver, from: x },
      ];
    }
    if (r < 0.13) {
      const x = other(resolver);
      return [
        { at: first, kind: "taken", by: x, to: x, from: null },
        { at: at(0.3), kind: "returned", by: x, to: null, from: x },
        { at: at(0.4), kind: "taken", by: resolver, to: resolver, from: null },
      ];
    }
    if (r < 0.4) return [{ at: first, kind: "assigned", by: admin, to: resolver, from: null }];
    return [{ at: first, kind: "taken", by: resolver, to: resolver, from: null }];
  };

  let id = 1;
  for (let d = 365; d >= 1; d--) {
    const day = today.getTime() - d * DAY;
    const dow = new Date(day).getDay();
    const weekend = dow === 0 || dow === 6;
    // Busier on Mondays and in winter (heating season → more field offices online).
    const month = new Date(day).getMonth();
    const base = weekend ? 0.4 : 4.2 + (dow === 1 ? 1.6 : 0) + (month <= 1 || month === 11 ? 1.2 : 0);
    const n = Math.max(0, Math.round(base + (rnd() - 0.5) * 3));
    for (let i = 0; i < n; i++) {
      const k = kind();
      const regional = rnd() < 0.32;
      const h = pick(regional ? reg : hq);
      const created = day + 9 * HOUR + rnd() * 8.5 * HOUR;
      const first = created + (5 + rnd() * 50) * MIN * (regional ? 1.6 : 1);
      const fix = k.fixMin * (0.4 + rnd() * 1.6) * (regional ? 1.8 : 1) * (rnd() < 0.07 ? 12 : 1);
      const resolver = rnd() < 0.08 ? admin : pick(agents);
      out.push({
        id: id++,
        created,
        first_response: first,
        resolved: first + fix * MIN,
        due: created + hoursOf(k.category) * HOUR,
        status: "closed",
        category: k.category,
        subject: k.subject,
        problem: k.problem && rnd() < 0.85 ? k.problem : null,
        hostname: h.hostname,
        requester: h.user,
        resolver,
        moves: movesFor(first, first + fix * MIN, regional, resolver),
      });
    }
  }
  return out;
}

// ---- the report --------------------------------------------------------------------------------

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const localDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monday = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

function scope(all: Fact[], q: ReportQuery) {
  return all.filter((f) => {
    const region = regionFromHost(f.hostname);
    if (q.origin && (q.origin === "region") !== !!region) return false;
    if (q.region && region !== q.region) return false;
    return true;
  });
}

export function buildReport(all: Fact[], q: ReportQuery): Report {
  const since = Date.parse(q.since);
  const until = q.until ? Date.parse(q.until) : Date.now();
  const scoped = scope(all, q);
  const facts = scoped.filter((f) => f.created >= since && f.created < until);
  const done = facts.filter((f) => f.resolved != null && f.status === "closed");
  const mins = (f: Fact) => ((f.resolved ?? 0) - f.created) / MIN;

  const count = <K,>(xs: Fact[], key: (f: Fact) => K | null) => {
    const m = new Map<K, Fact[]>();
    for (const f of xs) {
      const k = key(f);
      if (k == null) continue;
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m].sort((a, b) => b[1].length - a[1].length);
  };

  const unit: Report["trend_unit"] = until - since > 45 * DAY ? "week" : "day";
  const buckets = new Map<string, { created: number; resolved: number }>();
  const bucketOf = (t: number) => localDay(unit === "week" ? monday(t) : t);
  for (let t = unit === "week" ? monday(since) : since; t < until; t += unit === "week" ? 7 * DAY : DAY) buckets.set(bucketOf(t), { created: 0, resolved: 0 });
  for (const f of facts) {
    const b = buckets.get(bucketOf(f.created));
    if (b) b.created++;
  }
  for (const f of scoped) {
    if (f.resolved == null || f.resolved < since || f.resolved >= until) continue;
    const b = buckets.get(bucketOf(f.resolved));
    if (b) b.resolved++;
  }

  const agents = new Map<number, { agent: User; times: number[] }>();
  for (const f of done) {
    if (!f.resolver) continue;
    const a = agents.get(f.resolver.id) ?? { agent: f.resolver, times: [] };
    a.times.push(mins(f));
    agents.set(f.resolver.id, a);
  }

  return {
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    totals: {
      opened: facts.length,
      resolved: done.length,
      open_now: scoped.filter((f) => f.status !== "closed").length,
      late: done.filter((f) => (f.resolved ?? 0) > f.due).length,
      avg_resolution_minutes: avg(done.map(mins)),
      avg_first_response_minutes: avg(facts.filter((f) => f.first_response != null).map((f) => (f.first_response! - f.created) / MIN)),
    },
    by_origin: {
      hq: facts.filter((f) => !regionFromHost(f.hostname)).length,
      region: facts.filter((f) => regionFromHost(f.hostname)).length,
    },
    by_region: count(facts, (f) => regionFromHost(f.hostname)).map(([region, xs]) => ({
      region,
      opened: xs.length,
      resolved: xs.filter((f) => f.status === "closed").length,
    })),
    by_category: count(facts, (f) => f.category).map(([category, xs]) => ({
      category,
      opened: xs.length,
      avg_resolution_minutes: avg(xs.filter((f) => f.resolved != null).map(mins)),
    })),
    top_subjects: count(facts, (f) => subjectKey(f.subject))
      .slice(0, 10)
      .map(([, xs]) => ({ subject: xs[0].subject, category: xs[0].category, count: xs.length })),
    top_problems: count(facts, (f) => problemKey(f.problem))
      .slice(0, 10)
      .map(([problem, xs]) => ({ problem, count: xs.length })),
    top_devices: count(facts, (f) => f.hostname)
      .slice(0, 8)
      .map(([hostname, xs]) => ({ hostname, requester: xs[0].requester, region: regionFromHost(hostname), count: xs.length })),
    by_agent: [...agents.values()]
      .map((a) => ({ agent: a.agent, resolved: a.times.length, avg_resolution_minutes: avg(a.times) }))
      .sort((a, b) => b.resolved - a.resolved),
    trend: [...buckets].map(([date, v]) => ({ date, ...v })),
    trend_unit: unit,
    handoffs: buildHandoffs(all, q, until),
  };
}

/** The admin's SLA page: who closed how many in the period, and what came up most. */
export function buildTeamReport(all: Fact[], q: ReportQuery, now = Date.now()): TeamReport {
  const since = Date.parse(q.since);
  const until = q.until ? Date.parse(q.until) : now;
  const scoped = scope(all, q);
  const closed = scoped.filter((f) => f.status === "closed" && f.resolved != null && f.resolved >= since && f.resolved < until);
  const opened = scoped.filter((f) => f.created >= since && f.created < until);
  const mins = (f: Fact) => ((f.resolved ?? 0) - f.created) / MIN;

  const agents = new Map<number, { agent: User; times: number[]; by_category: Partial<Record<TicketCategory, number>> }>();
  for (const f of closed) {
    if (!f.resolver) continue;
    const a = agents.get(f.resolver.id) ?? { agent: f.resolver, times: [], by_category: {} };
    a.times.push(mins(f));
    a.by_category[f.category] = (a.by_category[f.category] ?? 0) + 1;
    agents.set(f.resolver.id, a);
  }
  const group = <K,>(xs: Fact[], key: (f: Fact) => K | null) => {
    const m = new Map<K, Fact[]>();
    for (const f of xs) {
      const k = key(f);
      if (k != null) m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m].sort((a, b) => b[1].length - a[1].length);
  };

  return {
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    opened: opened.length,
    closed: closed.length,
    avg_resolution_minutes: avg(closed.map(mins)),
    by_agent: [...agents.values()]
      .map((a) => ({ agent: a.agent, closed: a.times.length, avg_resolution_minutes: avg(a.times), by_category: a.by_category }))
      .sort((a, b) => b.closed - a.closed),
    top_problems: group(opened, (f) => problemKey(f.problem))
      .slice(0, 8)
      .map(([problem, xs]) => ({ problem, count: xs.length })),
    top_subjects: group(opened, (f) => subjectKey(f.subject))
      .slice(0, 8)
      .map(([, xs]) => ({ subject: xs[0].subject, category: xs[0].category, count: xs.length })),
    handoffs: buildHandoffs(all, q, now),
  };
}

/** Assignment moves in the period (by when they happened), as API.md describes for the server. */
function buildHandoffs(all: Fact[], q: ReportQuery, now = Date.now()): Handoffs {
  const since = Date.parse(q.since);
  const until = q.until ? Date.parse(q.until) : now;
  const facts = scope(all, q);
  const inPeriod = (m: Move) => m.at >= since && m.at < until;

  const per = new Map<number, Handoffs["per_agent"][number]>();
  const row = (u: User) => {
    let r = per.get(u.id);
    if (!r) per.set(u.id, (r = { agent: u, received: 0, taken: 0, moved_away: 0, returned: 0 }));
    return r;
  };
  let byAdmin = 0;
  let moved = 0;
  const chains: Handoffs["chains"] = [];

  for (const f of facts) {
    const moves = f.moves.filter(inPeriod);
    for (const m of moves) {
      const admin = m.by?.role === "admin" && ["assigned", "reassigned", "delegated"].includes(m.kind);
      if (admin) byAdmin++;
      if (m.from && m.to && m.from.id !== m.to.id) {
        moved++;
        row(m.from).moved_away++;
      }
      if (m.kind === "taken" && m.to) row(m.to).taken++;
      else if (admin && m.to) row(m.to).received++;
      if (m.kind === "returned" && m.from) row(m.from).returned++;
    }
    if (moves.length > 1)
      chains.push({
        ticket: { id: f.id, subject: f.subject, region: regionFromHost(f.hostname), status: f.status },
        steps: moves.map((m) => ({ at: new Date(m.at).toISOString(), kind: m.kind, by: m.by, to: m.to, from: m.from })),
      });
  }

  return {
    by_admin: byAdmin,
    moved,
    per_agent: [...per.values()].sort((a, b) => b.received + b.taken - (a.received + a.taken)),
    chains: chains.sort((a, b) => b.steps.length - a.steps.length || Date.parse(b.steps[0].at) - Date.parse(a.steps[0].at)).slice(0, 30),
  };
}
