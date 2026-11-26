import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/Board";
import { Avatar } from "@/components/ui/marks";
import { cn } from "@/components/ui/primitives";
import { dateTime, shortDate, ticketNo } from "@/lib/format";
import { regionName } from "@/lib/labels";
import type { Handoffs, HistoryKind, User } from "@/lib/types";
import { useNav } from "@/store/nav";

type Step = Handoffs["chains"][number]["steps"][number];

const KIND: Partial<Record<HistoryKind, string>> = {
  taken: "აიღო",
  assigned: "მიაწერა",
  reassigned: "გადააწერა",
  delegated: "გადასცა",
  unassigned: "მოხსნა",
  returned: "დააბრუნა",
};

/** Who held the ticket after each step: a person, or nobody (back in the queue). */
const holderAfter = (s: Step): User | null => (s.kind === "returned" || s.kind === "unassigned" ? null : s.to);

/** One step in words: "თორნიკემ გადააწერა გიორგი კაპანაძეს · 12 ნოე, 10:40". */
function stepText(s: Step) {
  const who = s.by?.full_name ?? "სისტემა";
  const verb = KIND[s.kind] ?? s.kind;
  const to = s.kind === "taken" || s.kind === "returned" || s.kind === "unassigned" ? "" : ` → ${s.to?.full_name ?? ""}`;
  return `${who}: ${verb}${to} (${dateTime(s.at)})`;
}

/** Admin report: what the admin handed out, who took what themselves, and tickets that changed hands. */
export function HandoffsPanel({ h, className }: { h: Handoffs; className?: string }) {
  const go = useNav((s) => s.go);
  return (
    <Panel title="მიწერები და გადაწერები" className={className} aside={<span className="text-[12px] text-ink-3">ვინ ვის გადასცა ამ პერიოდში</span>}>
      <p className="text-[13px] text-ink-2">
        ადმინმა მიაწერა <span className="tnum font-semibold text-ink">{h.by_admin}</span> · ერთიდან მეორეზე გადაწერილი{" "}
        <span className="tnum font-semibold text-ink">{h.moved}</span>
      </p>

      {h.per_agent.length > 0 && (
        <table className="mt-4 w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-3">
              <th className="pb-2 font-normal">სპეციალისტი</th>
              <th className="pb-2 text-right font-normal">ადმინმა მისცა</th>
              <th className="pb-2 text-right font-normal">თვითონ აიღო</th>
              <th className="pb-2 text-right font-normal">გადაეწერა სხვას</th>
              <th className="pb-2 text-right font-normal">დააბრუნა</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {h.per_agent.map((a) => (
              <tr key={a.agent.id}>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <Avatar user={a.agent} size={24} />
                    {a.agent.full_name}
                  </span>
                </td>
                <Num v={a.received} strong />
                <Num v={a.taken} />
                <Num v={a.moved_away} />
                <Num v={a.returned} />
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-6 mb-2 text-[12.5px] font-semibold text-ink-2">ერთზე მეტჯერ გადაცემული მოთხოვნები</h3>
      {h.chains.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-3">ამ პერიოდში მოთხოვნას ხელი არ გამოუცვლია.</p>
      ) : (
        <ul className="-mx-2">
          {h.chains.map((c) => (
            <li key={c.ticket.id}>
              <button
                onClick={() => go("queue", { scope: c.ticket.status === "closed" ? "closed" : "all", ticketId: c.ticket.id })}
                className="block w-full rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-hover"
              >
                <span className="flex items-baseline gap-2">
                  <span className="tnum shrink-0 text-[12px] text-ink-3">{ticketNo(c.ticket.id)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                    {c.ticket.subject}
                    {c.ticket.region && <span className="font-normal text-ink-3">, {regionName(c.ticket.region)}</span>}
                  </span>
                  <span className="tnum shrink-0 text-[12px] text-ink-3">
                    {shortDate(c.steps[0].at)}
                    {shortDate(c.steps[c.steps.length - 1].at) !== shortDate(c.steps[0].at) && ` – ${shortDate(c.steps[c.steps.length - 1].at)}`}
                  </span>
                </span>
                <Chain steps={c.steps} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** ნინო → გიორგი → ნინო: who held it, in order; hover a step for who moved it and when. */
function Chain({ steps }: { steps: Step[] }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => {
        const holder = holderAfter(s);
        return (
          <span key={i} className="flex items-center gap-1.5" title={stepText(s)}>
            {i > 0 && <ArrowRight className="size-3 shrink-0 text-ink-3" />}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-[12px]",
                holder ? "bg-sunken text-ink" : "bg-transparent pl-2 text-ink-3 ring-1 ring-line",
                s.by?.role === "admin" && s.kind !== "taken" && holder && "bg-accent-soft",
              )}
            >
              {holder && <Avatar user={holder} size={18} />}
              {holder ? holder.full_name : "რიგში"}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Num({ v, strong }: { v: number; strong?: boolean }) {
  return <td className={cn("tnum py-2 text-right", v === 0 ? "text-ink-3" : strong ? "font-medium" : "text-ink-2")}>{v}</td>;
}

/** CSV rows for the two report exports. */
export function handoffRows(h: Handoffs): (string | number | null)[][] {
  return [
    ["მიწერები და გადაწერები"],
    ["ადმინმა მიაწერა", h.by_admin],
    ["ერთიდან მეორეზე გადაწერილი", h.moved],
    [],
    ["სპეციალისტი", "ადმინმა მისცა", "თვითონ აიღო", "გადაეწერა სხვას", "დააბრუნა"],
    ...h.per_agent.map((a) => [a.agent.full_name, a.received, a.taken, a.moved_away, a.returned]),
    [],
    ["მოთხოვნა", "თემა", "ვის ჰქონდა რიგრიგობით", "ცვლილებები"],
    ...h.chains.map((c) => [
      ticketNo(c.ticket.id),
      c.ticket.subject,
      c.steps.map((s) => holderAfter(s)?.full_name ?? "რიგში").join(" → "),
      c.steps.map(stepText).join("; "),
    ]),
  ];
}
