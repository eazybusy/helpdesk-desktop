import { TARGET } from "@/lib/target";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AuditQuery, NewTicket, ReportQuery, SlaPolicy, TicketPatch, TicketQuery } from "@/lib/types";
import { api } from "./index";

const POLL = 30_000;

const keys = {
  tickets: (q: TicketQuery) => ["tickets", q] as const,
  ticket: (id: number) => ["ticket", id] as const,
  agents: ["agents"] as const,
  stats: ["stats"] as const,
};

/** Live views (the admin's SLA page) poll faster than the rest. */
export const LIVE_POLL = 10_000;

export const useTickets = (q: TicketQuery, enabled = true, poll = POLL) =>
  useQuery({
    queryKey: keys.tickets(q),
    queryFn: () => api().listTickets(q),
    refetchInterval: poll,
    // The desktop app lives in the tray: keep polling while its window is hidden, so notifications still arrive.
    refetchIntervalInBackground: TARGET !== "web",
    placeholderData: (p) => p,
    enabled,
  });

export const useTicket = (id: number | null) =>
  useQuery({
    queryKey: keys.ticket(id ?? 0),
    queryFn: () => api().getTicket(id!),
    enabled: id != null,
    // Right after a ticket is opened its RustDesk password is on the way from the PC: check more often for a few minutes.
    refetchInterval: (q) => {
      const t = q.state.data;
      const waiting = t?.remote?.rustdesk_id && !t.remote.password && Date.now() - Date.parse(t.created_at) < 3 * 60_000;
      return waiting ? 3_000 : POLL;
    },
  });

export const useAgents = (enabled = true) =>
  useQuery({ queryKey: keys.agents, queryFn: () => api().listAgents(), staleTime: 60_000, enabled });

export const useAudit = (q: AuditQuery, enabled = true, poll = POLL) =>
  useQuery({ queryKey: ["audit", q], queryFn: () => api().listAudit(q), refetchInterval: poll, placeholderData: (p) => p, enabled });

export const useReport = (q: ReportQuery) =>
  useQuery({ queryKey: ["report", q], queryFn: () => api().report(q), staleTime: 60_000, placeholderData: (p) => p });

export const useSlaPolicy = () => useQuery({ queryKey: ["sla"], queryFn: () => api().slaPolicy(), staleTime: 60_000 });

export const useTeamReport = (q: ReportQuery) =>
  useQuery({ queryKey: ["team-report", q], queryFn: () => api().teamReport(q), refetchInterval: LIVE_POLL, placeholderData: (p) => p });

export function useSetSlaPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hours: SlaPolicy["hours"]) => api().setSlaPolicy(hours),
    onSuccess: (p) => {
      qc.setQueryData(["sla"], p);
    },
    onError: errorToast,
  });
}

export const useStats = (enabled = true, poll = POLL) => useQuery({ queryKey: keys.stats, queryFn: () => api().stats(), refetchInterval: poll, enabled });

/** Live Event Log query beyond the snapshot attached to the ticket. `hours = 0` disables it. */
export const useUserEvents = (sam: string, hours: number, categories?: string[]) =>
  useQuery({
    queryKey: ["eventlogs", sam, hours, categories ?? []],
    queryFn: () => api().userEvents(sam, hours, categories),
    enabled: hours > 0,
    staleTime: 60_000,
    placeholderData: (p) => p,
  });

export const useUserDay = (sam: string, date: string | null) =>
  useQuery({ queryKey: ["eventlogs-day", sam, date], queryFn: () => api().userDay(sam, date!), enabled: !!date, staleTime: 60_000 });

export const useUserSessions = (sam: string, hours: number, enabled: boolean) =>
  useQuery({ queryKey: ["sessions", sam, hours], queryFn: () => api().userSessions(sam, hours), enabled, staleTime: 60_000 });

const errorToast = (e: unknown) => toast.error(e instanceof Error ? e.message : "მოქმედება ვერ შესრულდა.");

function useInvalidate() {
  const qc = useQueryClient();
  return (id?: number) => {
    if (id) qc.invalidateQueries({ queryKey: keys.ticket(id) });
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: keys.stats });
    qc.invalidateQueries({ queryKey: keys.agents });
    qc.invalidateQueries({ queryKey: ["audit"] });
    qc.invalidateQueries({ queryKey: ["team-report"] });
  };
}

export function useCreateTicket() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (data: NewTicket) => api().createTicket(data), onSuccess: () => inv(), onError: errorToast });
}

export function useUpdateTicket(id: number) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (patch: TicketPatch) => api().updateTicket(id, patch), onSuccess: () => inv(id), onError: errorToast });
}

export function useDelegate(id: number) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ assigneeId, note }: { assigneeId: number; note: string }) => api().delegate(id, assigneeId, note),
    onSuccess: () => inv(id),
    onError: errorToast,
  });
}

export function useAddComment(id: number) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (body: string) => api().addComment(id, body), onSuccess: () => inv(id), onError: errorToast });
}

export const useReplies = (enabled = true) => useQuery({ queryKey: ["replies"], queryFn: () => api().listReplies(), staleTime: 60_000, enabled });

/** Create (no id) or edit a ready-made reply. */
export function useSaveReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, body }: { id?: number; title: string; body: string }) => (id ? api().updateReply(id, { title, body }) : api().createReply({ title, body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["replies"] }),
    onError: errorToast,
  });
}

export function useDeleteReply() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api().deleteReply(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["replies"] }), onError: errorToast });
}

export function useReturnToDispatch(id: number) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (note: string) => api().returnToDispatch(id, note), onSuccess: () => inv(id), onError: errorToast });
}
