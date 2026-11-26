import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleCheck, Download, Inbox, MapPinned, Wrench } from "lucide-react";
import { LIVE_POLL, useAudit, useSetSlaPolicy, useSlaPolicy, useStats, useTeamReport, useTickets } from "@/api/queries";
import { Figure, Figures, Page, Panel, RankBars } from "@/components/Board";
import { handoffRows } from "@/components/Handoffs";
import { CAT_ICON } from "@/components/ui/categoryIcon";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar, StatusGlyph } from "@/components/ui/marks";
import { Button, Segmented, Skeleton, cn } from "@/components/ui/primitives";
import { PERIOD_LABEL, duration, hm, localDate, periodStart, relative, shortDate, type Period } from "@/lib/format";
import { CATEGORY, CATEGORY_ORDER, SLA_CHOICES, regionName } from "@/lib/labels";
import type { AuditEntry, Origin, ReportQuery, SlaPolicy, TeamReport, Ticket, TicketCategory, User } from "@/lib/types";
import { useNav } from "@/store/nav";

const mins = (m: number | null) => (m == null ? "—" : duration(m * 60_000));
const ORIGIN_LABEL = { "": "სათავო და რეგიონები", hq: "სათავო", region: "რეგიონები" } as const;

/**
 * Admin: SLA. What is happening right now (live, every 10 seconds), who closed how many in a
 * period, what comes up most often, and the deadline per category. The staff report is one CSV.
 */
export function Sla() {
  return (
    <Page>
      <h1 className="title-light text-[30px]">SLA</h1>
      <p className="mt-1 text-[14px] text-ink-2">ვინ რაზე მუშაობს ახლა, ვინ რამდენი შეასრულა და რა პრობლემა მეორდება ყველაზე ხშირად.</p>
      <Live />
      <Performance />
      <Deadlines />
    </Page>
  );
}

// ---------------------------------------------------------------- live

function Live() {
  const stats = useStats(true, LIVE_POLL);
  const active = useTickets({ scope: "all" }, true, LIVE_POLL);
  const go = useNav((s) => s.go);
  const s = stats.data;

  const byHolder = useMemo(() => {
    const m = new Map<number, Ticket[]>();
    for (const t of active.data ?? []) if (t.assignee) m.set(t.assignee.id, [...(m.get(t.assignee.id) ?? []), t]);
    return m;
  }, [active.data]);

  return (
    <section className="mt-8">
      <SectionHead title="ახლა">
        <LiveBadge at={stats.dataUpdatedAt} />
      </SectionHead>
      {!s ? (
        <Skeleton className="mt-4 h-[92px] rounded-panel" />
      ) : (
        <>
          <Figures className="mt-4">
            <Figure icon={<Inbox />} label="ახალი, ელოდება" value={s.new} alert={s.new > 0} onClick={() => go("queue", { scope: "unassigned", ticketId: null })} />
            <Figure icon={<Wrench />} label="მუშავდება" value={s.open} onClick={() => go("queue", { scope: "all", ticketId: null })} />
            <Figure icon={<CircleCheck />} label="დღეს დასრულდა" value={s.resolved_today} />
            <Figure icon={<MapPinned />} label="გასანაწილებელი" value={s.dispatch} tone="accent" onClick={() => go("queue", { scope: "dispatch", origin: "region", ticketId: null })} />
          </Figures>

          <div className="mt-6 grid grid-cols-[1.35fr_1fr] gap-6 max-[1100px]:grid-cols-1">
            <Panel title="ვინ რაზე მუშაობს">
              <ul className="-mx-1 space-y-1">
                {[...s.team]
                  .sort((a, b) => b.active - a.active || b.closed_today - a.closed_today)
                  .map((m) => (
                    <Worker key={m.agent.id} agent={m.agent} closedToday={m.closed_today} tickets={byHolder.get(m.agent.id) ?? []} />
                  ))}
              </ul>
            </Panel>
            <Feed />
          </div>
        </>
      )}
    </section>
  );
}

function LiveBadge({ at }: { at: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-raised px-3 py-1 text-[12px] text-ink-2 shadow-xs ring-1 ring-line">
      <span className="relative flex size-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-ok/60" />
        <span className="relative size-2 rounded-full bg-ok" />
      </span>
      ლაივ{at ? ` · ${new Date(at).toLocaleTimeString("en-GB")}` : ""}
    </span>
  );
}

function Worker({ agent, closedToday, tickets }: { agent: User; closedToday: number; tickets: Ticket[] }) {
  const go = useNav((s) => s.go);
  const busy = tickets.length > 0;
  return (
    <li className="flex gap-3 rounded-[10px] px-1 py-2">
      <Avatar user={agent} size={34} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] font-medium">{agent.full_name}</span>
          <span className="tnum shrink-0 text-[12.5px] text-ink-2">
            დღეს დაასრულა <span className="font-semibold text-ink">{closedToday}</span>
          </span>
        </div>
        {busy ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tickets.slice(0, 3).map((t) => (
              <button
                key={t.id}
                onClick={() => go("queue", { scope: "all", origin: t.region ? "region" : "hq", ticketId: t.id })}
                className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:bg-accent-soft hover:text-accent"
                title={t.subject}
              >
                <StatusGlyph status={t.status} className="size-3" />
                <span className="truncate">{t.subject}</span>
              </button>
            ))}
            {tickets.length > 3 && <span className="px-1 py-1 text-[12px] text-ink-3">+{tickets.length - 3}</span>}
          </div>
        ) : (
          <p className="mt-1 text-[12.5px] text-ink-3">ახლა თავისუფალია</p>
        )}
      </div>
    </li>
  );
}

const VERB: Partial<Record<AuditEntry["action"], (e: AuditEntry) => string>> = {
  created: () => "გამოაგზავნა",
  taken: () => "აიღო",
  assigned: (e) => `მიაწერა ${e.to?.full_name ?? ""}`,
  reassigned: (e) => `გადააწერა ${e.to?.full_name ?? ""}`,
  delegated: (e) => `გადასცა ${e.to?.full_name ?? ""}`,
  returned: () => "დააბრუნა",
  status: (e) => (e.value === "closed" ? "დაასრულა" : e.value === "open" ? "ხელახლა გახსნა" : "დააბრუნა რიგში"),
};

/** The last moves across the whole service, newest first; new ones slide in. */
function Feed() {
  const audit = useAudit({ limit: 14 }, true, LIVE_POLL);
  const go = useNav((s) => s.go);
  const items = (audit.data ?? []).filter((e) => VERB[e.action]).slice(0, 7);
  return (
    <Panel title="ბოლო მოქმედებები">
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-3">ჯერ არაფერი მომხდარა.</p>
      ) : (
        <ol className="-mx-1">
          {items.map((e) => (
            <li key={e.id} className="anim-up">
              <button
                onClick={() => go("queue", { scope: e.ticket.region ? "dispatch" : "all", origin: e.ticket.region ? "region" : "hq", ticketId: e.ticket.id })}
                className="flex w-full items-start gap-2.5 rounded-[9px] px-1 py-1.5 text-left transition-colors hover:bg-hover"
              >
                {e.actor ? <Avatar user={e.actor} size={24} className="mt-px" /> : <span className="size-6 shrink-0" />}
                <span className="min-w-0 flex-1 text-[13px] leading-snug">
                  <span className="font-medium">{e.actor?.full_name ?? "სისტემა"}</span> <span className="text-ink-2">{VERB[e.action]!(e)}</span>
                  <span className="block truncate text-[12.5px] text-ink-3">
                    {e.ticket.subject}
                    {e.ticket.region && `, ${regionName(e.ticket.region)}`}
                  </span>
                </span>
                <time className="tnum shrink-0 pt-px text-[12px] text-ink-3" dateTime={e.at} title={hm(e.at)}>
                  {relative(e.at)}
                </time>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- period

function Performance() {
  const [period, setPeriod] = useState<Period>("30");
  const [origin, setOrigin] = useState<Origin | "">("");
  const [frequent, setFrequent] = useState<"problems" | "requests">("problems");
  const today = localDate();
  const query = useMemo<ReportQuery>(() => ({ since: periodStart(Number(period), today), origin: origin || undefined }), [period, origin, today]);
  const report = useTeamReport(query);
  const r = report.data;

  return (
    <section className="mt-10">
      <SectionHead title="შესრულება">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Origin | "">
            value={origin}
            onChange={setOrigin}
            options={[
              { value: "", label: "ყველა" },
              { value: "hq", label: "სათავო" },
              { value: "region", label: "რეგიონები" },
            ]}
          />
          <Segmented<Period> value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          <Button icon={<Download className="size-3.5" />} onClick={() => r && exportTeam(r, ORIGIN_LABEL[origin])} disabled={!r}>
            რეპორტი
          </Button>
        </div>
      </SectionHead>

      {!r ? (
        <div className="mt-4 grid grid-cols-2 gap-6">
          <Skeleton className="h-[320px] rounded-panel" />
          <Skeleton className="h-[320px] rounded-panel" />
        </div>
      ) : (
        <div className={cn("mt-4 grid grid-cols-2 gap-6 transition-opacity max-[1100px]:grid-cols-1", report.isPlaceholderData && "opacity-60")}>
          <Panel title="ვინ რამდენი შეასრულა" aside={<Hint>{range(r.since, r.until)}</Hint>}>
            <Team r={r} />
          </Panel>
          <Panel
            title="ყველაზე ხშირი"
            aside={
              <Segmented<"problems" | "requests">
                value={frequent}
                onChange={setFrequent}
                options={[
                  { value: "problems", label: "პრობლემები" },
                  { value: "requests", label: "მოთხოვნები" },
                ]}
              />
            }
          >
            {frequent === "problems" ? (
              <RankBars total={r.opened} items={r.top_problems.map((x) => ({ key: x.problem, label: x.problem, value: x.count }))} empty="Event Log-მა ამ პერიოდში პრობლემა ვერ ამოიცნო." />
            ) : (
              <RankBars total={r.opened} items={r.top_subjects.map((x) => ({ key: x.subject, label: x.subject, sub: CATEGORY[x.category], value: x.count }))} empty="ამ პერიოდში მოთხოვნა არ შემოსულა." />
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}

function Team({ r }: { r: TeamReport }) {
  if (!r.by_agent.length) return <p className="py-6 text-center text-[13px] text-ink-3">ამ პერიოდში დასრულებული მოთხოვნა არ არის.</p>;
  const max = Math.max(1, ...r.by_agent.map((a) => a.closed));
  return (
    <>
      <ul className="space-y-4">
        {r.by_agent.map((a) => (
          <li key={a.agent.id} className="flex items-center gap-3">
            <Avatar user={a.agent} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13.5px]">{a.agent.full_name}</span>
                <span className="tnum shrink-0 text-[12px] text-ink-3">საშ. {mins(a.avg_resolution_minutes)}</span>
              </div>
              <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-sunken">
                <span className="block h-full rounded-full bg-chart-1 transition-[width] duration-500" style={{ width: `${(a.closed / max) * 100}%` }} />
              </span>
            </div>
            <span className="tnum w-10 shrink-0 text-right text-[18px] font-medium">{a.closed}</span>
          </li>
        ))}
      </ul>
      <p className="tnum mt-5 border-t border-line pt-3 text-[12.5px] text-ink-2">
        სულ დასრულდა <span className="font-semibold text-ink">{r.closed}</span> · საშუალოდ {mins(r.avg_resolution_minutes)}
      </p>
    </>
  );
}

// ---------------------------------------------------------------- deadlines

/** The deadline each new ticket gets, per category. IT specialists see it on their tickets. */
function Deadlines() {
  const policy = useSlaPolicy();
  const save = useSetSlaPolicy();
  const p = policy.data;
  const change = (c: TicketCategory, h: number, current: SlaPolicy) =>
    save.mutate({ ...current.hours, [c]: h }, { onSuccess: () => toast.success(`${CATEGORY[c]}: ვადა ${h} სთ`, { description: "ახალ მოთხოვნებზე ვრცელდება." }) });

  return (
    <section className="mt-10">
      <SectionHead title="ვადები">
        <Hint>ახალი მოთხოვნა ამდენ საათში უნდა დასრულდეს. ცვლილება ეხება ახალ მოთხოვნებს.</Hint>
      </SectionHead>
      {!p ? (
        <Skeleton className="mt-4 h-[200px] rounded-panel" />
      ) : (
        <div className="mt-4 rounded-panel border border-line bg-raised px-5 py-3 shadow-card">
          <ul className="grid grid-cols-2 gap-x-8 max-[900px]:grid-cols-1">
            {CATEGORY_ORDER.map((c) => (
              <li key={c} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0 max-[900px]:[&:nth-last-child(2)]:border-b [&:nth-last-child(2)]:border-b-0">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent [&>svg]:size-4 [&>svg]:stroke-[1.7]">{CAT_ICON[c]}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{CATEGORY[c]}</span>
                <span className="w-[96px] shrink-0">
                  <Dropdown<number>
                    label={`${CATEGORY[c]}: ვადა`}
                    value={p.hours[c]}
                    onChange={(h) => h !== p.hours[c] && change(c, h, p)}
                    disabled={save.isPending}
                    align="right"
                    options={[...new Set([...SLA_CHOICES, p.hours[c]])].sort((a, b) => a - b).map((h) => ({ value: h, label: `${h} სთ` }))}
                  />
                </span>
              </li>
            ))}
          </ul>
          {p.updated_by && p.updated_at && (
            <p className="mt-1 border-t border-line pt-2.5 pb-1 text-[12px] text-ink-3">
              ბოლოს შეცვალა {p.updated_by.full_name}, {shortDate(p.updated_at)} {hm(p.updated_at)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- pieces

function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[18px] font-semibold tracking-[-0.01em]">{title}</h2>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] text-ink-3">{children}</span>;
}

/** "19 ოქტ – 17 ნოე"; just the date for a single day. */
function range(since: string, until: string) {
  const last = new Date(Date.parse(until) - 1).toISOString();
  return shortDate(since) === shortDate(last) ? shortDate(since) : `${shortDate(since)} – ${shortDate(last)}`;
}

/** The staff report: who closed how many (and of what), plus the most frequent problems and requests. Excel-friendly CSV. */
function exportTeam(r: TeamReport, scope: string) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const pct = (n: number) => (r.closed ? Math.round((n / r.closed) * 100) : 0);
  const rows: (string | number | null | undefined)[][] = [
    ["IT გუნდის შესრულება", scope, `${r.since.slice(0, 10)} – ${new Date(Date.parse(r.until) - 1).toISOString().slice(0, 10)}`],
    [],
    ["სპეციალისტი", "დაასრულა", "წილი, %", "საშ. დასრულება, წთ", ...CATEGORY_ORDER.map((c) => CATEGORY[c])],
    ...r.by_agent.map((a) => [a.agent.full_name, a.closed, pct(a.closed), a.avg_resolution_minutes, ...CATEGORY_ORDER.map((c) => a.by_category[c] ?? 0)]),
    ["სულ", r.closed, 100, r.avg_resolution_minutes],
    [],
    ["ყველაზე ხშირი პრობლემები (Event Log)", "რაოდენობა"],
    ...r.top_problems.map((x) => [x.problem, x.count]),
    [],
    ["ყველაზე ხშირი მოთხოვნები", "კატეგორია", "რაოდენობა"],
    ...r.top_subjects.map((x) => [x.subject, CATEGORY[x.category], x.count]),
    [],
    ...handoffRows(r.handoffs),
  ];
  const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `it-team-${localDate()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
