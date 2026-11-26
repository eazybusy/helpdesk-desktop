import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTickets } from "@/api/queries";
import { genitive, ticketNo } from "@/lib/format";
import { regionName } from "@/lib/labels";
import { notify } from "@/lib/tauri";
import type { Ticket, User } from "@/lib/types";
import { useNav } from "@/store/nav";
import { isStaff, useSession } from "@/store/session";

/** What the user last saw of a ticket: status, holder, number of comments (c is missing in older saves). */
type Seen = { s: Ticket["status"]; a: number | null; c?: number };
const seenOf = (t: Ticket): Seen => ({ s: t.status, a: t.assignee?.id ?? null, c: t.comment_count });
const seenKey = (userId: number) => `hd-seen-${userId}`;

function loadSeen(userId: number): Map<number, Seen> | null {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return raw ? new Map(Object.entries(JSON.parse(raw) as Record<string, Seen>).map(([k, v]) => [Number(k), v])) : null;
  } catch {
    return null;
  }
}

function saveSeen(userId: number, list: Ticket[]) {
  try {
    const obj: Record<number, Seen> = {};
    for (const t of list) obj[t.id] = seenOf(t);
    localStorage.setItem(seenKey(userId), JSON.stringify(obj));
  } catch {
    /* storage unavailable: notifications still work while the app runs */
  }
}

type Message = { title: string; body: string; done: boolean };

/** What the employee should hear about changes on their own ticket (a new comment, and/or a status or holder change). */
function employeeMessages(t: Ticket, old: Seen): Message[] {
  const by = (u: User | null) => (u ? ` ${genitive(u.full_name)} მიერ` : "");
  const ticket = `${ticketNo(t.id)} ${t.subject}`;
  const out: Message[] = [];
  if (t.last_comment && t.comment_count > (old.c ?? t.comment_count)) {
    const n = t.comment_count - (old.c ?? 0);
    const text = t.last_comment.body.length > 100 ? `${t.last_comment.body.slice(0, 99)}…` : t.last_comment.body;
    out.push({ title: n > 1 ? `${n} ახალი კომენტარი: ${ticket}` : `ახალი კომენტარი: ${ticket}`, body: `${t.last_comment.author.full_name}: ${text}`, done: false });
  }
  if (t.status !== old.s) {
    if (t.status === "closed") out.push({ title: `თქვენი მოთხოვნა დასრულდა${by(t.resolved_by ?? t.assignee)}`, body: ticket, done: true });
    else if (old.s === "closed") out.push({ title: "თქვენი მოთხოვნა ხელახლა გაიხსნა", body: ticket, done: false });
  } else if (t.assignee && t.assignee.id !== old.a && t.status !== "closed") {
    // Taken, assigned, delegated or moved to someone else.
    out.push({ title: `თქვენი მოთხოვნა მუშავდება${by(t.assignee)}`, body: ticket, done: false });
  }
  return out;
}

/**
 * Watches the polled ticket lists and tells the user about changes:
 * - employee (desktop app, also from the tray): IT commented, someone took the ticket, it was closed or reopened.
 *   Changes made while the app wasn't running are reported on the next start.
 * - admin: new regional ticket waiting for delegation, and any new ticket
 * - agent: new ticket in the shared queue, a ticket delegated to them
 * In-app toast while the window is in front, a Windows notification otherwise.
 */
export function useNotifier(viewer: User) {
  const staff = isStaff(viewer);
  const admin = viewer.role === "admin";
  const enabled = useSession((s) => s.notifications);
  const main = useTickets({ scope: staff ? "all" : "requested" });
  const dispatch = useTickets({ scope: "dispatch" }, admin);
  const prev = useRef<Map<number, Seen> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!main.data || (admin && !dispatch.data)) return;
    const all = [...main.data, ...(dispatch.data ?? [])];
    // Staff compare against the previous poll; employees also against what they saw last time the app ran.
    const before = prev.current ?? (!staff && first.current ? loadSeen(viewer.id) : null);
    first.current = false;
    prev.current = new Map(all.map((t) => [t.id, seenOf(t)]));
    if (!staff) saveSeen(viewer.id, all);
    if (!before || !enabled) return;

    const focused = document.visibilityState === "visible" && document.hasFocus();
    const open = (id: number) => () => useNav.getState().go(staff ? "queue" : "mine", { ticketId: id });

    if (!staff) {
      for (const t of all) {
        const old = before.get(t.id);
        if (!old) continue;
        for (const m of employeeMessages(t, old)) {
          if (focused) (m.done ? toast.success : toast.info)(m.title, { description: m.body, action: { label: "ნახვა", onClick: open(t.id) } });
          else notify(m.title, m.body);
        }
      }
      return;
    }

    if (focused) return;
    for (const t of all) {
      const old = before.get(t.id);
      if (!old) {
        if (admin && t.region && !t.assignee) notify(`გასანაწილებელი: ${regionName(t.region)}`, `${ticketNo(t.id)} ${t.subject}`);
        else if (t.assignee?.id === viewer.id) notify(`მოგენიჭა ${ticketNo(t.id)}`, t.subject);
        else if (!t.region) notify(`ახალი მოთხოვნა ${ticketNo(t.id)}`, `${t.requester.full_name}: ${t.subject}`);
        continue;
      }
      if (t.assignee?.id === viewer.id && old.a !== viewer.id) {
        notify(`მოგენიჭა ${ticketNo(t.id)}`, t.delegation_note ? `${t.subject}\n${t.delegation_note}` : t.subject);
      }
    }
  }, [main.data, dispatch.data, enabled, staff, admin, viewer.id]);
}
