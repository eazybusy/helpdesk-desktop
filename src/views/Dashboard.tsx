import { useMemo } from "react";
import { AlarmClock, Building2, CircleCheck, Inbox, MapPinned, Timer, UserRound } from "lucide-react";
import { useStats, useTickets } from "@/api/queries";
import { Deadline } from "@/components/ui/deadline";
import { Avatar, StatusGlyph } from "@/components/ui/marks";
import { Figure, Figures, Legend, Page, Panel, TrendChart } from "@/components/Board";
import { Skeleton } from "@/components/ui/primitives";
import { duration } from "@/lib/format";
import { regionName } from "@/lib/labels";
import type { Ticket, User } from "@/lib/types";
import { useNav } from "@/store/nav";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "დილა მშვიდობისა" : h < 18 ? "გამარჯობა" : "საღამო მშვიდობისა";
}

const byDue = (a: Ticket, b: Ticket) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9");

export function Dashboard({ viewer }: { viewer: User }) {
  return viewer.role === "admin" ? <AdminDashboard viewer={viewer} /> : <AgentDashboard viewer={viewer} />;
}

// ---------------------------------------------------------------- IT specialist: own work only

function AgentDashboard({ viewer }: { viewer: User }) {
  const stats = useStats();
  const mine = useTickets({ scope: "mine" });
  const free = useTickets({ scope: "unassigned" });
  const go = useNav((s) => s.go);
  const s = stats.data;
  if (!s) return <DashboardSkeleton />;

  const summary = [
    s.mine ? `შენზე ${s.mine} აქტიური მოთხოვნაა` : "შენზე აქტიური მოთხოვნა არ არის",
    ...(s.overdue ? [`${s.overdue}-ს ვადა გადაცილებული აქვს`] : []),
  ].join(", ") + (s.unassigned ? `. შემოსულებში ${s.unassigned} ელოდება.` : ".");

  return (
    <Page>
      <Hello name={viewer.full_name} summary={summary} />
      <Figures>
        <Figure icon={<UserRound />} label="ჩემზე აქტიური" value={s.mine} onClick={() => go("queue", { scope: "mine", ticketId: null })} />
        <Figure icon={<AlarmClock />} label="ვადაგადაცილებული" value={s.overdue} alert={s.overdue > 0} />
        <Figure icon={<CircleCheck />} label="დღეს დავასრულე" value={s.resolved_today} />
        <Figure icon={<Inbox />} label="შემოსული" value={s.unassigned} tone="accent" onClick={() => go("queue", { scope: "unassigned", ticketId: null })} />
      </Figures>
      <div className="mt-6 grid grid-cols-2 gap-6">
        <Panel title="ჩემი მოთხოვნები">
          <TicketRows items={[...(mine.data ?? [])].sort(byDue).slice(0, 6)} scope="mine" empty="შენზე აქტიური მოთხოვნა არ არის." />
        </Panel>
        <Panel title="შემოსული, ასაღები">
          <TicketRows items={(free.data ?? []).slice(0, 6)} scope="unassigned" empty="შემოსული მოთხოვნა არ არის." showRequester />
        </Panel>
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------- admin: the whole service

function AdminDashboard({ viewer }: { viewer: User }) {
  const stats = useStats();
  const active = useTickets({ scope: "all" });
  const dispatch = useTickets({ scope: "dispatch" });
  const go = useNav((s) => s.go);

  const attention = useMemo(() => {
    const now = Date.now();
    return [...(dispatch.data ?? []), ...(active.data ?? [])]
      // Overdue, due within 2 hours, or still nobody's after an hour.
      .filter((t) => (t.due_at && Date.parse(t.due_at) < now + 2 * 3_600_000) || (!t.assignee && now - Date.parse(t.created_at) > 3_600_000))
      .sort(byDue)
      .slice(0, 6);
  }, [active.data, dispatch.data]);

  const s = stats.data;
  if (!s) return <DashboardSkeleton />;

  const summary = [
    s.dispatch ? `${s.dispatch} რეგიონული მოთხოვნა ელოდება განაწილებას` : "გასანაწილებელი არაფერია",
    s.overdue ? `${s.overdue}-ს ვადა გადაცილებული აქვს` : "ვადაგადაცილებული არაფერია",
  ].join(", ") + ".";

  return (
    <Page>
      <Hello name={viewer.full_name} summary={summary} />
      <Figures>
        <Figure icon={<MapPinned />} label="გასანაწილებელი" value={s.dispatch} tone="accent" onClick={() => go("queue", { scope: "dispatch", ticketId: null })} />
        <Figure icon={<Building2 />} label="სათავო, აქტიური" value={s.by_origin?.hq ?? 0} onClick={() => go("queue", { scope: "all", origin: "hq", ticketId: null })} />
        <Figure icon={<Inbox />} label="რეგიონები, აქტიური" value={s.by_origin?.region ?? 0} onClick={() => go("queue", { scope: "all", origin: "region", ticketId: null })} />
        <Figure icon={<AlarmClock />} label="ვადაგადაცილებული" value={s.overdue} alert={s.overdue > 0} />
        <Figure icon={<Timer />} label="საშუალო პასუხი" value={s.avg_first_response_minutes != null ? duration(s.avg_first_response_minutes * 60000) : "—"} />
      </Figures>

      <div className="mt-6 grid grid-cols-[1.55fr_1fr] gap-6">
        <Panel title="ბოლო 14 დღე" aside={<Legend />}>
          <TrendChart data={s.daily} />
        </Panel>
        <Panel title="გუნდი">
          <ul className="space-y-3">
            {s.team.filter((m) => m.agent.role === "agent").map((m) => (
              <li key={m.agent.id} className="flex items-center gap-3">
                <Avatar user={m.agent} size={28} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{m.agent.full_name}</span>
                {m.overdue > 0 && <span className="tnum text-[12px] whitespace-nowrap text-critical">{m.overdue} ვადაგადაცილებული</span>}
                <span className="tnum w-20 text-right text-[12.5px] whitespace-nowrap text-ink-2">{m.active} აქტიური</span>
              </li>
            ))}
          </ul>
          {s.by_region.length > 0 && (
            <p className="mt-5 border-t border-line pt-3 text-[12.5px] text-ink-2">
              რეგიონებიდან: {s.by_region.map((r) => `${regionName(r.region)} ${r.count}`).join(", ")}
            </p>
          )}
        </Panel>
      </div>

      <Panel title="საჭიროებს ყურადღებას" className="mt-6">
        <TicketRows items={attention} scope="all" empty="სასწრაფო ან ვადაგადაცილებული მოთხოვნა არ არის." showRequester />
      </Panel>
    </Page>
  );
}

// ---------------------------------------------------------------- pieces

function DashboardSkeleton() {
  return (
    <Page>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-3 h-4 w-96" />
      <div className="mt-7 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-panel" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 rounded-panel" />
    </Page>
  );
}

function Hello({ name, summary }: { name: string; summary: string }) {
  return (
    <>
      <h1 className="title-light text-[30px]">{greeting()}, {name.split(" ")[0]}</h1>
      <p className="mt-1 text-[14px] text-ink-2">{summary}</p>
    </>
  );
}

function TicketRows({ items, scope, empty, showRequester }: { items: Ticket[]; scope: "mine" | "unassigned" | "all"; empty: string; showRequester?: boolean }) {
  const go = useNav((s) => s.go);
  if (!items.length) return <p className="py-6 text-center text-[13px] text-ink-3">{empty}</p>;
  return (
    <ul className="-mx-2">
      {items.map((t) => (
        <li key={t.id}>
          <button
            onClick={() => go("queue", { scope: t.region && !t.assignee ? "dispatch" : scope, ticketId: t.id })}
            className="grid w-full grid-cols-[16px_1fr_auto] items-center gap-3 rounded-[9px] px-2 py-2 text-left transition-colors hover:bg-ink/[0.035]"
          >
            <StatusGlyph status={t.status} />
            <span className="min-w-0 truncate text-[13.5px]">
              {t.subject}
              {showRequester && <span className="ml-2 text-[12.5px] text-ink-3">{t.requester.full_name}</span>}
            </span>
            {t.status !== "closed" && <Deadline created={t.created_at} due={t.due_at} />}
          </button>
        </li>
      ))}
    </ul>
  );
}

