import type { ReactNode } from "react";
import { HAS_EMPLOYEE, HAS_STAFF } from "@/lib/target";
import { Activity, BarChart3, Building2, CheckCheck, History, Inbox, LayoutGrid, MapPinned, Plus, SlidersHorizontal } from "lucide-react";
import { useStats } from "@/api/queries";
import type { Origin, TicketScope } from "@/lib/types";
import { useNav } from "@/store/nav";
import { useSession } from "@/store/session";
import { cn } from "./ui/primitives";

export function Sidebar() {
  const user = useSession((s) => s.user)!;
  const { view, scope, origin, go } = useNav();
  const stats = useStats(user.role !== "user");
  const s = stats.data;
  const queue = (sc: TicketScope | TicketScope[]) => view === "queue" && (Array.isArray(sc) ? sc.includes(scope) : scope === sc);
  const open = (sc: TicketScope, o: Origin | null = null) => () => go("queue", { scope: sc, origin: o, ticketId: null });
  const active = (o: Origin) => view === "queue" && origin === o && ["all", "unassigned", "mine"].includes(scope);

  return (
    <nav className="flex w-[248px] shrink-0 max-[1180px]:w-[212px] flex-col border-r border-[var(--side-line)] bg-[var(--side-bg)] px-4 pt-5 pb-3">
      {HAS_EMPLOYEE && user.role === "user" && (
        <>
          {/* Filled while you're on the form, outlined elsewhere: always findable, never shouting. */}
          <button
            onClick={() => go("new")}
            aria-current={view === "new" ? "page" : undefined}
            className={cn(
              "mb-4 flex h-11 items-center justify-center gap-2 rounded-field border text-[14px] font-semibold transition-[background-color,border-color,color,transform] active:scale-[0.98]",
              view === "new"
                ? "border-[var(--cta-bg)] bg-[var(--cta-bg)] text-[var(--cta-ink)] shadow-btn hover:bg-[var(--cta-bg-hover)]"
                : "border-[var(--cta-outline-line)] bg-[var(--cta-outline-bg)] text-[var(--cta-outline-ink)] hover:bg-[var(--cta-outline-hover)]",
            )}
          >
            <Plus className="size-[17px]" strokeWidth={2} />
            ახალი მოთხოვნა
          </button>
          <Item icon={<Inbox />} active={view === "mine"} onClick={() => go("mine", { ticketId: null })}>
            ჩემი მოთხოვნები
          </Item>
        </>
      )}

      {HAS_STAFF && user.role === "agent" && (
        <>
          <Item icon={<LayoutGrid />} active={view === "dashboard"} onClick={() => go("dashboard")}>
            მიმოხილვა
          </Item>
          <Item icon={<Inbox />} active={queue(["mine", "unassigned", "closed"])} onClick={open(s?.mine ? "mine" : "unassigned")} count={s?.unassigned} hint="შემოსული">
            მოთხოვნები
          </Item>
        </>
      )}

      {HAS_STAFF && user.role === "admin" && (
        <>
          <Item icon={<LayoutGrid />} active={view === "dashboard"} onClick={() => go("dashboard")}>
            მიმოხილვა
          </Item>
          <Item icon={<Activity />} active={view === "sla"} onClick={() => go("sla")} hint="ლაივ: ვინ რაზე მუშაობს, შესრულება, ხშირი პრობლემები">
            SLA
          </Item>
          <Group>სათავო</Group>
          <Item icon={<Building2 />} active={active("hq")} onClick={open("all", "hq")} count={s?.by_origin?.hq} quiet hint="აქტიური">
            მოთხოვნები
          </Item>
          <Group>რეგიონები</Group>
          <Item icon={<MapPinned />} active={queue("dispatch")} onClick={open("dispatch", "region")} count={s?.dispatch} hint="ელოდება განაწილებას">
            გასანაწილებელი
          </Item>
          <Item icon={<Inbox />} active={active("region")} onClick={open("all", "region")} count={s?.by_origin ? s.by_origin.region - s.dispatch : undefined} quiet hint="განაწილებული, აქტიური">
            მოთხოვნები
          </Item>
          <Group>არქივი და ანგარიში</Group>
          <Item icon={<CheckCheck />} active={queue("closed")} onClick={open("closed")}>
            დასრულებული
          </Item>
          <Item icon={<BarChart3 />} active={view === "report"} onClick={() => go("report")}>
            რეპორტი
          </Item>
          <Item icon={<History />} active={view === "journal"} onClick={() => go("journal")}>
            ჟურნალი
          </Item>
        </>
      )}

      <div className="mt-auto pt-3">
        <Item icon={<SlidersHorizontal />} active={view === "settings"} onClick={() => go("settings")}>
          პარამეტრები
        </Item>
      </div>
    </nav>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <p className="eyebrow mt-4 mb-1.5 px-2.5 !text-[var(--side-ink-3)]">{children}</p>;
}

/** quiet: a plain count (how many), not an accent badge (needs action). */
function Item({ icon, active, onClick, count, hint, quiet, children }: { icon: ReactNode; active: boolean; onClick: () => void; count?: number; hint?: string; quiet?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group mb-0.5 flex h-10 w-full items-center gap-3 rounded-item px-3 text-[14px] transition-[background-color,color] duration-150 [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:stroke-[1.7]",
        active
          ? "bg-[var(--side-active-bg)] font-semibold text-[var(--side-active-ink)] [&>svg]:text-[var(--side-active-ink)]"
          : "text-[var(--side-ink-2)] hover:bg-[var(--side-hover)] hover:text-[var(--side-ink)] [&>svg]:text-[var(--side-ink-3)] hover:[&>svg]:text-[var(--side-ink-2)]",
      )}
    >
      {icon}
      <span className="flex-1 truncate text-left">{children}</span>
      {!!count &&
        (quiet ? (
          <span className="tnum text-[12px] text-[var(--side-ink-3)]" title={hint}>{count}</span>
        ) : (
          <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink" title={hint}>
            {count}
          </span>
        ))}
    </button>
  );
}
