import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Inbox,
  Layers,
  Search,
  Wrench,
} from "lucide-react";
import { useTickets } from "@/api/queries";
import { TicketDetail } from "@/components/TicketDetail";
import { CAT_ICON } from "@/components/ui/categoryIcon";
import { StatusBadge } from "@/components/ui/marks";
import { Empty, Input, Skeleton, cn } from "@/components/ui/primitives";
import { dateTime, hm, localDate, shortDate, ticketNo } from "@/lib/format";
import type { Ticket, User } from "@/lib/types";
import { useNav } from "@/store/nav";

/**
 * Employee: every request they sent. Four counts on top that also filter, then a short plain list:
 * what, when, who is on it, status. Unfinished first. A row opens the request full-width, with a way back.
 */
export function MyRequests({ viewer }: { viewer: User }) {
  const { ticketId, select } = useNav();
  if (ticketId != null)
    return (
      <RequestPage id={ticketId} viewer={viewer} onBack={() => select(null)} />
    );
  return <RequestTable onOpen={select} />;
}

type Filter = "all" | "waiting" | "working" | "done";

const isDone = (t: Ticket) => t.status === "closed";
const inFilter: Record<Filter, (t: Ticket) => boolean> = {
  all: () => true,
  waiting: (t) => t.status === "new",
  working: (t) => t.status === "open",
  done: isDone,
};

function RequestTable({ onOpen }: { onOpen: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  const query = useTickets({ scope: "requested", q: debounced || undefined });
  // Unfinished first, newest first within each.
  const all = useMemo(
    () =>
      [...(query.data ?? [])].sort(
        (a, b) =>
          Number(isDone(a)) - Number(isDone(b)) ||
          b.created_at.localeCompare(a.created_at),
      ),
    [query.data],
  );
  const rows = all.filter(inFilter[filter]);
  const count = (f: Filter) => all.filter(inFilter[f]).length;

  return (
    <div className="h-full overflow-y-auto bg-panel">
      <div className="@container mx-auto flex min-h-full max-w-[1180px] flex-col px-10 pt-9 pb-10 max-[900px]:px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="title-light text-[30px]">ჩემი მოთხოვნები</h1>
            <p className="mt-1.5 text-[14px] text-ink-2">
              შენ მიერ გაგზავნილი მოთხოვნები და მათი სტატუსი
            </p>
          </div>
          <div className="relative w-[280px] max-[700px]:w-full">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-ink-3"
              strokeWidth={1.7}
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ძებნა: სათაური, ნომერი"
              aria-label="ძებნა"
              className="h-10 rounded-field pl-9 text-[13.5px]"
            />
          </div>
        </div>

        {/* Counts double as filters. */}
        <div
          role="radiogroup"
          aria-label="ფილტრი"
          className="mt-6 grid grid-cols-4 gap-3 @max-[640px]:grid-cols-2"
        >
          <Stat
            on={filter === "all"}
            onClick={() => setFilter("all")}
            label="ყველა"
            value={count("all")}
            icon={<Layers />}
            tone="accent"
          />
          <Stat
            on={filter === "waiting"}
            onClick={() => setFilter("waiting")}
            label="ელოდება IT-ს"
            value={count("waiting")}
            icon={<Clock />}
            tone="status-new"
          />
          <Stat
            on={filter === "working"}
            onClick={() => setFilter("working")}
            label="მუშავდება"
            value={count("working")}
            icon={<Wrench />}
            tone="status-open"
          />
          <Stat
            on={filter === "done"}
            onClick={() => setFilter("done")}
            label="დასრულებული"
            value={count("done")}
            icon={<CheckCircle2 />}
            tone="status-closed"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-panel border border-line bg-raised shadow-card anim-up">
          {query.isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !rows.length ? (
            <Empty
              icon={<Inbox />}
              title={
                debounced
                  ? "ვერაფერი მოიძებნა"
                  : filter === "all"
                    ? "მოთხოვნა ჯერ არ გაგიგზავნია"
                    : "ამ ჯგუფში მოთხოვნა არ არის"
              }
            >
              {debounced
                ? "სცადე სხვა სიტყვა."
                : filter === "all"
                  ? "პრობლემის შემთხვევაში დააჭირე „ახალი მოთხოვნა“-ს."
                  : "აირჩიე „ყველა“."}
            </Empty>
          ) : (
            <ul>
              {rows.map((t) => (
                <li
                  key={t.id}
                  className="border-b border-line-strong/40 last:border-b-0"
                >
                  <Row t={t} onOpen={() => onOpen(t.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  on,
  onClick,
  label,
  value,
  icon,
  tone,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  value: number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-panel border bg-raised px-4 py-3.5 text-left shadow-card transition-[border-color,box-shadow] @max-[860px]:gap-2.5 @max-[860px]:px-3",
        on
          ? "border-accent shadow-[0_0_0_3px_var(--ring)]"
          : "border-line hover:border-line-strong",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-tile @max-[860px]:size-8 [&>svg]:size-[19px] @max-[860px]:[&>svg]:size-4 [&>svg]:stroke-[1.7]",
          tone === "accent"
            ? "bg-accent-soft text-accent"
            : cn("status-pill !shadow-none", tone),
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="mono block text-[22px] leading-none font-medium">
          {value}
        </span>
        <span className="mt-1 block truncate text-[12.5px] text-ink-2">
          {label}
        </span>
      </span>
    </button>
  );
}

/** "დღეს, 09:34" / "გუშინ, 18:02" / "11 ნოე". */
function when(iso: string) {
  const d = localDate(new Date(iso));
  const today = new Date();
  if (d === localDate(today)) return `დღეს, ${hm(iso)}`;
  today.setDate(today.getDate() - 1);
  if (d === localDate(today)) return `გუშინ, ${hm(iso)}`;
  return shortDate(iso);
}

/** Who is on it, in plain words; nothing when there is nothing to add to the status. */
function who(t: Ticket) {
  if (t.status === "open" && t.assignee)
    return `${t.assignee.full_name} მუშაობს`;
  if (t.status === "closed" && (t.resolved_by ?? t.assignee))
    return `დაასრულა ${(t.resolved_by ?? t.assignee)!.full_name}`;
  return null;
}

function Row({ t, onOpen }: { t: Ticket; onOpen: () => void }) {
  const done = isDone(t);
  const by = who(t);
  return (
    <button
      onClick={onOpen}
      aria-label={`${ticketNo(t.id)} ${t.subject}`}
      className="group flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-hover focus-visible:bg-accent-soft/60 focus-visible:outline-none"
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full [&>svg]:size-[17px] [&>svg]:stroke-[1.7]",
          done ? "bg-sunken text-ink-3" : "bg-accent-soft text-accent",
        )}
      >
        {CAT_ICON[t.category]}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[14.5px] font-medium",
            done ? "text-ink-2" : "text-ink",
          )}
        >
          {t.subject}
        </span>
        <span
          className="mt-0.5 block truncate text-[12.5px] text-ink-3"
          title={dateTime(t.created_at)}
        >
          {when(t.created_at)}
          {by && ` · ${by}`}
        </span>
      </span>
      <StatusBadge status={t.status} />
    </button>
  );
}

function RequestPage({
  id,
  viewer,
  onBack,
}: {
  id: number;
  viewer: User;
  onBack: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" &&
      !document.querySelector("[role=dialog], [role=listbox]") &&
      onBack();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);
  return (
    <div className="h-full overflow-y-auto bg-panel">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-10 pt-5 pb-7 max-[900px]:px-5">
        <button
          onClick={onBack}
          className={cn(
            "mb-4 inline-flex h-9 w-fit items-center gap-2 rounded-item px-2.5 -ml-2.5 text-[13.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink",
          )}
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          ჩემი მოთხოვნები
        </button>
        <div className="overflow-hidden rounded-panel border border-line bg-raised shadow-card anim-up">
          <TicketDetail id={id} viewer={viewer} />
        </div>
      </div>
    </div>
  );
}
