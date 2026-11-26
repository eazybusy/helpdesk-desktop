import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Download, History, Search, ShieldCheck } from "lucide-react";
import { useAgents, useAudit } from "@/api/queries";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/marks";
import { Button, Empty, Input, Segmented, Skeleton, cn } from "@/components/ui/primitives";
import { dateTime, hm, localDate, shortDate, ticketNo } from "@/lib/format";
import { CATEGORY, STATUS, regionName } from "@/lib/labels";
import type { AuditEntry, AuditQuery, HistoryKind, TicketCategory, TicketStatus, User } from "@/lib/types";
import { useNav } from "@/store/nav";

const ACTION: Record<HistoryKind, { label: string; tone: string }> = {
  taken: { label: "აიღო", tone: "text-ok bg-ok/10 ring-ok/25" },
  assigned: { label: "მიწერა", tone: "text-st-open bg-[var(--st-open-bg)] ring-[var(--st-open-ring)]" },
  reassigned: { label: "გადაწერა", tone: "text-high bg-high/10 ring-high/25" },
  delegated: { label: "დელეგირება", tone: "text-accent bg-accent-soft ring-[var(--ring)]" },
  unassigned: { label: "მოხსნა", tone: "text-ink-2 bg-sunken ring-line" },
  returned: { label: "დაბრუნება", tone: "text-critical bg-critical/8 ring-critical/20" },
  status: { label: "სტატუსი", tone: "text-accent bg-accent-soft ring-accent/20" },
  category: { label: "კატეგორია", tone: "text-ink-2 bg-sunken ring-line" },
  created: { label: "შეიქმნა", tone: "text-ink-2 bg-sunken ring-line" },
  commented: { label: "კომენტარი", tone: "text-st-open bg-[var(--st-open-bg)] ring-[var(--st-open-ring)]" },
};

const CLIENT: Record<NonNullable<AuditEntry["client"]>, string> = { web: "ვები", desktop: "აპი", agent: "PC" };

type Period = "today" | "7" | "30" | "all";

/** Start of the day `daysBack` days ago — stable for the whole day, so the query key doesn't change every render. */
function sinceFor(p: Period, today: string): string | undefined {
  if (p === "all") return undefined;
  const d = new Date(`${today}T00:00:00`);
  if (p !== "today") d.setDate(d.getDate() - Number(p) + 1);
  return d.toISOString();
}

const valueLabel = (e: AuditEntry) =>
  e.action === "status" ? STATUS[e.value as TicketStatus]
  : e.action === "category" ? CATEGORY[e.value as TicketCategory]
  : e.value;

/** Admin: every take / assign / reassign / delegate / return, who did it, when and from where. */
export function Journal({ viewer }: { viewer: User }) {
  const [kind, setKind] = useState<"assignment" | "all">("assignment");
  const [person, setPerson] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>("30");
  const [q, setQ] = useState("");
  const today = localDate();
  const query = useMemo<AuditQuery>(
    () => ({ action: kind === "assignment" ? "assignment" : undefined, person_id: person ?? undefined, since: sinceFor(period, today), q: q.trim() || undefined, limit: 1000 }),
    [kind, person, period, q, today],
  );
  const audit = useAudit(query);
  const agents = useAgents();
  const go = useNav((s) => s.go);
  // Only the kinds this app can describe.
  const entries = useMemo(() => (audit.data ?? []).filter((e) => e.action in ACTION), [audit.data]);

  const days = useMemo(() => {
    const out: { day: string; items: AuditEntry[] }[] = [];
    for (const e of entries) {
      const day = localDate(new Date(e.at));
      if (out[out.length - 1]?.day !== day) out.push({ day, items: [] });
      out[out.length - 1].items.push(e);
    }
    return out;
  }, [entries]);

  const dayLabel = (day: string) => {
    const y = new Date(`${today}T00:00:00`);
    y.setDate(y.getDate() - 1);
    return day === today ? "დღეს" : day === localDate(y) ? "გუშინ" : shortDate(`${day}T12:00:00`);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-10 pt-9 pb-10 max-[900px]:px-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="title-light text-[30px]">ჟურნალი</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2">
              <ShieldCheck className="size-3.5 shrink-0 text-ok" />
              ყველა აღება, მიწერა, გადაწერა და დაბრუნება ინახება. ჩანაწერს ვერავინ შეცვლის ან წაშლის.
            </p>
          </div>
          <Button icon={<Download className="size-3.5" />} onClick={() => exportCsv(entries)} disabled={!entries.length}>
            CSV
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Segmented<"assignment" | "all">
            value={kind}
            onChange={setKind}
            options={[
              { value: "assignment", label: "მიწერები" },
              { value: "all", label: "ყველა მოქმედება" },
            ]}
          />
          <div className="w-[220px]">
            <Dropdown<number | null>
              label="თანამშრომელი"
              value={person}
              onChange={setPerson}
              options={[
                { value: null, label: "ყველა თანამშრომელი" },
                ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.full_name, icon: <Avatar user={a} size={18} /> })),
              ]}
            />
          </div>
          <div className="w-[160px]">
            <Dropdown<Period>
              label="პერიოდი"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "today", label: "დღეს" },
                { value: "7", label: "ბოლო 7 დღე" },
                { value: "30", label: "ბოლო 30 დღე" },
                { value: "all", label: "მთელი პერიოდი" },
              ]}
            />
          </div>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="მოთხოვნის ნომერი ან თემა" className="pl-8" />
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-panel border border-line bg-raised shadow-card">
          <div className="grid grid-cols-[56px_minmax(140px,1fr)_104px_minmax(170px,1.3fr)_minmax(230px,1.6fr)_112px] items-center gap-3 border-b border-line bg-sunken/50 px-4 py-2 text-[12px] font-medium text-ink-3 max-[1100px]:grid-cols-[56px_minmax(130px,1fr)_100px_minmax(150px,1.2fr)_minmax(200px,1.5fr)] [&>*:last-child]:max-[1100px]:hidden">
            <span>დრო</span>
            <span>ვინ</span>
            <span>მოქმედება</span>
            <span>მოთხოვნა</span>
            <span>დეტალი</span>
            <span>საიდან</span>
          </div>

          {audit.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : !entries.length ? (
            <Empty icon={<History />} title="ჩანაწერი არ არის">შეცვალე ფილტრი ან პერიოდი.</Empty>
          ) : (
            days.map((d) => (
              <section key={d.day}>
                <h2 className="sticky top-0 border-b border-line bg-raised/95 px-4 py-1.5 text-[12px] font-semibold text-ink-2 backdrop-blur">
                  {dayLabel(d.day)} <span className="font-normal text-ink-3">· {d.items.length}</span>
                </h2>
                <ul className="divide-y divide-line">
                  {d.items.map((e) => (
                    <Row key={e.id} e={e} viewer={viewer} onOpen={() => go("queue", { scope: "all", ticketId: e.ticket.id })} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        {entries.length >= (query.limit ?? 0) && <p className="mt-3 text-center text-[12px] text-ink-3">ნაჩვენებია ბოლო {query.limit} ჩანაწერი. დააზუსტე ფილტრი.</p>}
      </div>
    </div>
  );
}

function Row({ e, viewer, onOpen }: { e: AuditEntry; viewer: User; onOpen: () => void }) {
  const a = ACTION[e.action];
  return (
    <li className="grid grid-cols-[56px_minmax(140px,1fr)_104px_minmax(170px,1.3fr)_minmax(230px,1.6fr)_112px] items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-hover max-[1100px]:grid-cols-[56px_minmax(130px,1fr)_100px_minmax(150px,1.2fr)_minmax(200px,1.5fr)] [&>*:last-child]:max-[1100px]:hidden">
      <time className="tnum text-ink-2" title={dateTime(e.at)}>{hm(e.at)}</time>
      <Person user={e.actor} viewer={viewer} fallback="სისტემა" />
      <span>
        <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset", a.tone)}>{a.label}</span>
      </span>
      <button onClick={onOpen} className="group flex min-w-0 items-baseline gap-1.5 text-left" title="მოთხოვნის გახსნა">
        <span className="tnum shrink-0 text-ink-3 group-hover:text-accent">{ticketNo(e.ticket.id)}</span>
        <span className="truncate group-hover:text-accent group-hover:underline">{e.ticket.subject}</span>
        {e.ticket.region && <span className="shrink-0 text-[12px] text-ink-3">{regionName(e.ticket.region)}</span>}
      </button>
      <div className="min-w-0">
        <Detail e={e} viewer={viewer} />
        {e.note && <p data-selectable className="mt-0.5 truncate text-[12px] text-ink-3" title={e.note}>„{e.note}“</p>}
      </div>
      <span className="truncate text-[12px] text-ink-3" title={e.ip ?? undefined}>
        {e.client ? CLIENT[e.client] : ""}
        {e.ip && <span className="tnum"> · {e.ip}</span>}
      </span>
    </li>
  );
}

function Detail({ e, viewer }: { e: AuditEntry; viewer: User }): ReactNode {
  if (e.action === "taken") return <span className="text-ink-2">თავისუფალი რიგიდან</span>;
  if (e.action === "returned") return <span className="text-ink-2">{e.ticket.region ? "ადმინს, გასანაწილებლად" : "თავისუფალ რიგში"}</span>;
  if (e.from || e.to) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        {e.from && <Person user={e.from} viewer={viewer} small dim={!!e.to} />}
        {e.from && e.to && <ArrowRight className="size-3 shrink-0 text-ink-3" />}
        {e.to && <Person user={e.to} viewer={viewer} small />}
      </span>
    );
  }
  const v = valueLabel(e);
  return v ? <span className="text-ink-2">→ {v}</span> : <span className="text-ink-3">—</span>;
}

function Person({ user, viewer, fallback, small, dim }: { user: User | null; viewer: User; fallback?: string; small?: boolean; dim?: boolean }) {
  if (!user) return <span className="text-ink-3">{fallback ?? "—"}</span>;
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", dim && "opacity-70")}>
      <Avatar user={user} size={small ? 18 : 22} />
      <span className={cn("truncate", small && "text-[12.5px]")} title={user.id === viewer.id ? `${user.full_name} (შენ)` : user.full_name}>{user.full_name}</span>
    </span>
  );
}

/** Excel-friendly CSV (UTF-8 BOM, so Georgian shows correctly). */
function exportCsv(entries: AuditEntry[]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    // Leading = + - @ would be run as a formula by Excel.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ["დრო", "ვინ", "მოქმედება", "მოთხოვნა", "თემა", "ვისგან", "ვის", "მნიშვნელობა", "შენიშვნა", "კლიენტი", "IP"];
  const rows = entries.map((e) => [
    `${localDate(new Date(e.at))} ${hm(e.at)}`,
    e.actor?.full_name ?? "სისტემა",
    ACTION[e.action].label,
    ticketNo(e.ticket.id),
    e.ticket.subject,
    e.from?.full_name,
    e.to?.full_name,
    valueLabel(e),
    e.note,
    e.client ? CLIENT[e.client] : "",
    e.ip,
  ]);
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `helpdesk-journal-${localDate()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
