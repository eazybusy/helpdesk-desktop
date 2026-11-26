import { memo } from "react";
import { relative } from "@/lib/format";
import { CATEGORY, regionName } from "@/lib/labels";
import type { Ticket } from "@/lib/types";
import { Deadline } from "./ui/deadline";
import { StatusBadge } from "./ui/marks";
import { cn } from "./ui/primitives";

export function TicketList({
  tickets,
  selected,
  onSelect,
  showRequester,
}: {
  tickets: Ticket[];
  selected: number | null;
  onSelect: (id: number) => void;
  showRequester: boolean;
}) {
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "j" && e.key !== "k") return;
    e.preventDefault();
    const i = tickets.findIndex((t) => t.id === selected);
    const next = e.key === "ArrowDown" || e.key === "j" ? Math.min(tickets.length - 1, i + 1) : Math.max(0, i - 1);
    const t = tickets[next];
    if (t) {
      onSelect(t.id);
      document.getElementById(`tk-${t.id}`)?.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <ul role="listbox" aria-label="მოთხოვნები" tabIndex={0} onKeyDown={onKey} className="p-2 focus:outline-none">
      {tickets.map((t) => (
        <Row key={t.id} t={t} active={t.id === selected} onSelect={onSelect} showRequester={showRequester} />
      ))}
    </ul>
  );
}

const Row = memo(function Row({ t, active, onSelect, showRequester }: { t: Ticket; active: boolean; onSelect: (id: number) => void; showRequester: boolean }) {
  const done = t.status === "closed";
  const meta = showRequester ? t.requester.full_name : CATEGORY[t.category];
  return (
    <li
      id={`tk-${t.id}`}
      role="option"
      aria-selected={active}
      onClick={() => onSelect(t.id)}
      className={cn(
        "relative mb-1 flex gap-3 rounded-[10px] py-2.5 pr-3 pl-2.5 transition-[background-color,box-shadow] duration-150",
        active ? "bg-accent-soft shadow-[inset_0_0_0_1px_var(--ring)]" : "hover:bg-ink/[0.035]",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", t.status === "new" ? "font-semibold" : "font-medium", done && "text-ink-2")}>{t.subject}</span>
          <span className="shrink-0 text-[12px] text-ink-3">{relative(t.updated_at)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-2">
          <StatusBadge status={t.status} className="h-5 text-[11.5px]" />
          <span className="min-w-0 flex-1 truncate">
            {meta}
            {t.region && <span className="text-ink-3">, {regionName(t.region)}</span>}
          </span>
          {/* The deadline is IT's business; employees don't see it. */}
          {showRequester && !done && <Deadline created={t.created_at} due={t.due_at} variant="compact" />}
        </div>
      </div>
    </li>
  );
});
