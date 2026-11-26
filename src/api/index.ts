import type {
  Agent,
  AuditEntry,
  AuditQuery,
  Report,
  ReportQuery,
  SlaPolicy,
  TeamReport,
  Device,
  LogEvent,
  LogSession,
  LoginResult,
  NewTicket,
  Stats,
  Ticket,
  TicketDetail,
  TicketPatch,
  TicketQuery,
  User,
} from "@/lib/types";
import { useSession } from "@/store/session";
import { DEMO_ALLOWED } from "@/lib/target";
import { createHttpApi } from "./http";

export interface HelpDeskApi {
  /** Web (staff): email + password. */
  login(email: string, password: string, remember: boolean): Promise<LoginResult>;
  /** Desktop (employee): no password — the Windows account and the device key identify the PC. */
  deviceSession(device: Device): Promise<LoginResult>;
  me(): Promise<User>;
  listTickets(query: TicketQuery): Promise<Ticket[]>;
  getTicket(id: number): Promise<TicketDetail>;
  createTicket(data: NewTicket): Promise<Ticket>;
  updateTicket(id: number, patch: TicketPatch): Promise<Ticket>;
  /** Admin: hand a ticket (usually regional) to an agent. */
  delegate(id: number, assigneeId: number, note: string): Promise<Ticket>;
  /** Assigned agent: send a delegated ticket back to the admin's dispatch inbox. */
  returnToDispatch(id: number, note: string): Promise<Ticket>;
  listAgents(): Promise<Agent[]>;
  /** Admin: the audit journal (who took / assigned / reassigned / returned what, when, from where). */
  listAudit(query: AuditQuery): Promise<AuditEntry[]>;
  /** Admin: counts and most frequent requests/problems for a period. */
  report(query: ReportQuery): Promise<Report>;
  stats(): Promise<Stats>;
  /** Deadlines per category (staff read, admin writes). */
  slaPolicy(): Promise<SlaPolicy>;
  setSlaPolicy(hours: SlaPolicy["hours"]): Promise<SlaPolicy>;
  /** Admin: who closed how many and the most frequent problems, for a period. */
  teamReport(query: ReportQuery): Promise<TeamReport>;

  // eventlog-pipeline (/api/v1/eventlogs), IT only
  userEvents(sam: string, hours: number, categories?: string[]): Promise<LogEvent[]>;
  userDay(sam: string, date: string): Promise<{ events: LogEvent[]; total_events: number }>;
  userSessions(sam: string, hours: number): Promise<LogSession[]>;
}

let cached: { key: string; api: HelpDeskApi } | null = null;

/** Desktop only: the X-Device-Key from the registry (set at start-up, never persisted). */
export const deviceKeyRef: { current: string | null } = { current: null };

/** The in-memory demo backend, loaded on demand (dev / demo / preview builds only). */
let mockApi: HelpDeskApi | null = null;
let mockLoading: Promise<void> | null = null;

/** Loads the demo backend before first use; production builds skip it. Call once at start-up. */
export function prepareApi(): Promise<void> {
  if (DEMO_ALLOWED) {
    mockLoading ??= import("./mock").then(({ createMockApi }) => {
      mockApi = createMockApi(() => useSession.getState().user);
    });
    return mockLoading;
  }
  return Promise.resolve();
}

/** Returns the mock or HTTP client depending on the current settings. */
export function api(): HelpDeskApi {
  const { useMock, apiUrl } = useSession.getState();
  const deviceKey = deviceKeyRef.current;
  if (DEMO_ALLOWED && useMock && mockApi) return mockApi;
  const key = `http:${apiUrl}:${deviceKey ?? ""}`;
  if (cached?.key === key) return cached.api;
  const instance = createHttpApi(
    apiUrl,
    () => useSession.getState().token,
    () => useSession.getState().logout(),
    deviceKey,
  );
  cached = { key, api: instance };
  return instance;
}
