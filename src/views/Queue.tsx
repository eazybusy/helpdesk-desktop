import { useEffect, useMemo, useState } from "react";
import { Inbox, Search } from "lucide-react";
import { useStats, useTickets } from "@/api/queries";
import { TicketDetail } from "@/components/TicketDetail";
import { TicketList } from "@/components/TicketList";
import { Dropdown } from "@/components/ui/Dropdown";
import { Empty, Input, Segmented, Skeleton } from "@/components/ui/primitives";
import { regionName } from "@/lib/labels";
import type { Origin, Ticket, TicketScope, User } from "@/lib/types";
import { useNav } from "@/store/nav";

const TITLES: Record<TicketScope, string> = {
  all: "ყველა აქტიური",
  mine: "ჩემზე მიწერილი",
  unassigned: "მიუწერელი",
  dispatch: "გასანაწილებელი",
  closed: "დასრულებული",
  requested: "ჩემი მოთხოვნები",
};

const EMPTY: Record<TicketScope, [string, string]> = {
  all: ["აქტიური მოთხოვნა არ არის", "ახალი მოთხოვნები აქ გამოჩნდება და შეტყობინებასაც მიიღებ."],
  mine: ["შენზე აქტიური მოთხოვნა არ არის", "აიღე მოთხოვნა თავისუფალი მოთხოვნების სიიდან."],
  unassigned: ["შემოსული მოთხოვნა არ არის", "თანამშრომლების ახალი მოთხოვნები აქ ჩნდება."],
  dispatch: ["რეგიონიდან გასანაწილებელი არაფერია", "reg-* კომპიუტერებიდან მოსული მოთხოვნები აქ ჩნდება, სანამ შემსრულებელს არ გადააწერ."],
  closed: ["დასრულებული მოთხოვნა ჯერ არ არის", ""],
  requested: ["მოთხოვნა ჯერ არ გაგიგზავნია", "პრობლემის შემთხვევაში დააჭირე „ახალი მოთხოვნა“-ს."],
};

/** Tickets sorted the way a technician works them: overdue first, then by status and deadline. */
function triage(list: Ticket[]) {
  const st = { new: 0, open: 1, closed: 2 };
  const now = Date.now();
  const late = (t: Ticket) => (t.due_at && Date.parse(t.due_at) < now ? 0 : 1);
  return [...list].sort(
    (a, b) => late(a) - late(b) || st[a.status] - st[b.status] || (a.due_at ?? "").localeCompare(b.due_at ?? ""),
  );
}

const GROUPS: Partial<Record<"admin" | "agent", { scopes: TicketScope[]; label: (s: TicketScope, n: { mine?: number; free?: number }) => string }>> = {
  agent: {
    scopes: ["mine", "unassigned", "closed"],
    label: (s, n) => (s === "mine" ? `ჩემზე${n.mine ? ` ${n.mine}` : ""}` : s === "unassigned" ? `შემოსული${n.free ? ` ${n.free}` : ""}` : "დასრულებული"),
  },
  admin: {
    scopes: ["all", "unassigned", "mine"],
    label: (s, n) => (s === "all" ? "ყველა" : s === "unassigned" ? `მიუწერელი${n.free ? ` ${n.free}` : ""}` : `ჩემზე${n.mine ? ` ${n.mine}` : ""}`),
  },
};

const ORIGIN_TITLE: Record<Origin, string> = { hq: "სათავო", region: "რეგიონები" };

export function TicketsView({ viewer, scope, origin }: { viewer: User; scope: TicketScope; origin?: Origin | null }) {
  const { ticketId, select, setScope, go } = useNav();
  const admin = viewer.role === "admin";
  const o = admin ? (origin ?? undefined) : undefined;
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const staff = viewer.role !== "user";
  const stats = useStats(staff).data;
  const regions = admin && o !== "hq" ? (stats?.by_region ?? []) : [];
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  // Empty filters stay undefined so the key matches other users of the same list (sidebar, notifier) and polls once.
  const query = useTickets({ scope, origin: o, q: debounced || undefined, region: region || undefined });
  const filtered = !!(q || region);
  const tickets = useMemo(
    () => (scope === "closed" || scope === "requested" ? [...(query.data ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : triage(query.data ?? [])),
    [query.data, scope],
  );

  // Open the first ticket when nothing is selected. A selected ticket that leaves the list
  // (e.g. after taking it from the incoming queue) stays open, so follow-up actions never land elsewhere.
  useEffect(() => {
    // Wait for the real list: placeholder data still belongs to the previous tab.
    if (ticketId == null && tickets.length && !query.isPlaceholderData) select(tickets[0].id);
  }, [tickets, ticketId, select, query.isPlaceholderData]);

  const [emptyTitle, emptyBody] = EMPTY[scope];
  // Admin: the scope tabs only for head office; regional tickets are routed through "გასანაწილებელი".
  const group = viewer.role === "agent" || (admin && o === "hq") ? GROUPS[viewer.role as "agent" | "admin"] : undefined;
  const inGroup = group?.scopes.includes(scope);
  const title =
    viewer.role === "agent" ? "მოთხოვნები"
    : admin && o && scope !== "closed" && scope !== "dispatch" ? ORIGIN_TITLE[o]
    : TITLES[scope];
  const subtitle = admin && scope === "dispatch" ? "რეგიონები" : admin && o && scope !== "closed" ? "აქტიური მოთხოვნები" : null;

  return (
    <div className="flex h-full min-w-0 gap-4 p-5 max-[900px]:gap-3 max-[900px]:p-3">
      <div className="flex w-[clamp(290px,30vw,360px)] shrink-0 flex-col overflow-hidden rounded-panel border border-line bg-raised shadow-card">
        <div className="space-y-3 px-4 pt-5 pb-3">
          <div>
            {subtitle && <p className="eyebrow mb-0.5">{subtitle}</p>}
            <h2 className="display text-[17px]">{title}</h2>
          </div>
          {admin && scope === "closed" && (
            <Segmented<Origin | "">
              className="w-full [&>button]:flex-1"
              value={origin ?? ""}
              onChange={(v) => go("queue", { scope: "closed", origin: v || null, ticketId: null })}
              options={[
                { value: "", label: "ყველა" },
                { value: "hq", label: "სათავო" },
                { value: "region", label: "რეგიონები" },
              ]}
            />
          )}
          {group && inGroup && (
            <Segmented<TicketScope>
              className="w-full [&>button]:flex-1"
              value={scope}
              onChange={setScope}
              options={group.scopes.map((sc) => ({ value: sc, label: group.label(sc, { mine: stats?.mine, free: stats?.unassigned }) }))}
            />
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={staff ? "ძებნა: თემა, სახელი, კომპიუტერი" : "ძებნა"} className="pl-8" />
          </div>
          {staff && (
            <div className="flex gap-2">
              {regions.length > 0 && (
                <div className="min-w-0 flex-1">
                  <Dropdown<string>
                    label="რეგიონი"
                    value={region}
                    onChange={setRegion}
                    options={[{ value: "", label: "ყველა რეგიონი" }, ...regions.map((r) => ({ value: r.region, label: regionName(r.region), hint: `${r.count} აქტიური` }))]}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
          {query.isLoading ? (
            <ListSkeleton />
          ) : tickets.length === 0 ? (
            <Empty icon={<Inbox />} title={filtered ? "ვერაფერი მოიძებნა" : emptyTitle}>
              {filtered ? "სცადე სხვა საძიებო სიტყვა ან მოხსენი ფილტრი." : emptyBody}
            </Empty>
          ) : (
            <TicketList tickets={tickets} selected={ticketId} onSelect={select} showRequester={staff} />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-hidden rounded-panel border border-line bg-raised shadow-card">
        {ticketId != null ? (
          <TicketDetail key={ticketId} id={ticketId} viewer={viewer} />
        ) : (
          !query.isLoading && <Empty icon={<Inbox />} title="აირჩიე მოთხოვნა" />
        )}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-1 p-2" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="space-y-2 rounded-[10px] px-3 py-3">
          <Skeleton className="h-3.5 w-[78%]" />
          <Skeleton className="h-3 w-[46%]" />
        </li>
      ))}
    </ul>
  );
}
