import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HAS_STAFF } from "@/lib/target";
import { Activity, BarChart3, CheckCheck, CircleDashed, History, Inbox, LayoutGrid, MapPinned, Moon, Plus, Search, Settings, Ticket, UserRound } from "lucide-react";
import { useTickets } from "@/api/queries";
import { ticketNo } from "@/lib/format";
import type { User } from "@/lib/types";
import { useNav } from "@/store/nav";
import { isStaff, useSession } from "@/store/session";
import { StatusGlyph } from "./ui/marks";
import { Kbd, cn } from "./ui/primitives";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette({ viewer }: { viewer: User }) {
  const { paletteOpen, setPalette, go } = useNav();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const staff = HAS_STAFF && isStaff(viewer);

  const search = q || undefined;
  const open = useTickets({ scope: staff ? "all" : "requested", q: search }, paletteOpen);
  const closed = useTickets({ scope: "closed", q: search }, paletteOpen && staff);
  const dispatch = useTickets({ scope: "dispatch", q: search }, paletteOpen && staff && viewer.role === "admin");

  useEffect(() => {
    if (paletteOpen) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [paletteOpen]);
  useEffect(() => setActive(0), [q]);

  const items = useMemo<Item[]>(() => {
    const close = (fn: () => void) => () => {
      fn();
      setPalette(false);
    };
    const actions: Item[] = [
      ...(staff ? [] : [{ id: "new", label: "ახალი მოთხოვნა", hint: "Ctrl N", icon: <Plus />, run: close(() => go("new")) }]),
      ...(staff
        ? [
            { id: "dash", label: "მიმოხილვა", icon: <LayoutGrid />, run: close(() => go("dashboard")) },
            ...(viewer.role === "admin" ? [{ id: "dispatch", label: "გასანაწილებელი", icon: <MapPinned />, run: close(() => go("queue", { scope: "dispatch", ticketId: null })) }] : []),
            ...(viewer.role === "admin" ? [{ id: "all", label: "აქტიური მოთხოვნები", icon: <Inbox />, run: close(() => go("queue", { scope: "all", ticketId: null })) }] : []),
            { id: "mine", label: "ჩემზე", icon: <UserRound />, run: close(() => go("queue", { scope: "mine", ticketId: null })) },
            { id: "un", label: viewer.role === "admin" ? "მიუწერელი" : "შემოსული", icon: <CircleDashed />, run: close(() => go("queue", { scope: "unassigned", ticketId: null })) },
            { id: "done", label: "დასრულებული", icon: <CheckCheck />, run: close(() => go("queue", { scope: "closed", ticketId: null })) },
            ...(viewer.role === "admin"
              ? [
                  { id: "sla", label: "SLA — ლაივი და შესრულება", icon: <Activity />, run: close(() => go("sla")) },
                  { id: "report", label: "რეპორტი", icon: <BarChart3 />, run: close(() => go("report")) },
                  { id: "journal", label: "ჟურნალი", icon: <History />, run: close(() => go("journal")) },
                ]
              : []),
          ]
        : [{ id: "my", label: "ჩემი მოთხოვნები", icon: <Ticket />, run: close(() => go("mine")) }]),
      {
        id: "theme",
        label: "თემის გადართვა",
        icon: <Moon />,
        run: close(() => {
          const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
          useSession.getState().set({ theme: next });
        }),
      },
      { id: "settings", label: "პარამეტრები", hint: "Ctrl ,", icon: <Settings />, run: close(() => go("settings")) },
    ];
    const needle = q.trim().toLowerCase();
    const matchedActions = needle ? actions.filter((a) => a.label.toLowerCase().includes(needle)) : actions;
    const tickets = [...(dispatch.data ?? []), ...(open.data ?? []), ...(staff ? (closed.data ?? []) : [])].slice(0, 8).map<Item>((t) => ({
      id: `t${t.id}`,
      label: t.subject,
      hint: staff ? t.requester.full_name : undefined,
      icon: (
        <span className="flex items-center gap-2">
          <StatusGlyph status={t.status} />
          <span className="tnum w-10 text-[12px] text-ink-3">{ticketNo(t.id)}</span>
        </span>
      ),
      run: close(() => {
        const done = t.status === "closed";
        if (viewer.role === "admin") go("queue", { scope: done ? "closed" : t.region && !t.assignee ? "dispatch" : "all", ticketId: t.id });
        else if (staff) go("queue", { scope: done ? "closed" : t.assignee?.id === viewer.id ? "mine" : "unassigned", ticketId: t.id });
        else go("mine", { ticketId: t.id });
      }),
    }));
    return needle ? [...tickets, ...matchedActions] : [...matchedActions, ...tickets.slice(0, 5)];
  }, [q, open.data, closed.data, dispatch.data, staff, viewer.role, viewer.id, go, setPalette]);

  if (!paletteOpen) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((a) => Math.min(items.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter") items[active]?.run();
    else if (e.key === "Escape") setPalette(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className="anim-fade fixed inset-0 z-50 bg-[rgb(13_27_42/0.22)] pt-[12vh] backdrop-blur-[2px] dark:bg-black/50" onMouseDown={() => setPalette(false)}>
      <div
        role="dialog"
        aria-label="ძებნა"
        className="anim-pop mx-auto w-[580px] overflow-hidden rounded-[16px] bg-raised shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="მოთხოვნის ნომერი, თემა ან მოქმედება"
            className="h-12 flex-1 bg-transparent text-[14px] placeholder:text-ink-3 focus:outline-none"
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[360px] overflow-y-auto p-1.5">
          {items.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-3">ვერაფერი მოიძებნა</li>}
          {items.map((it, i) => (
            <li
              key={it.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={it.run}
              className={cn(
                "flex h-9 items-center gap-3 rounded-[8px] px-3 text-[13px] [&_svg.lucide]:size-4 [&_svg.lucide]:text-ink-3",
                i === active && "bg-ink/[0.055]",
              )}
            >
              {it.icon}
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.hint && <span className="shrink-0 text-[12px] text-ink-3">{it.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
