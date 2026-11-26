import type {
  CannedReply,
  TicketComment,
  Agent,
  AuditEntry,
  AuditQuery,
  Report,
  ReportQuery,
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
  SlaPolicy,
  TeamReport,
} from "@/lib/types";
import type { HelpDeskApi } from "./index";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** REST client for the FastAPI backend. Endpoints are documented in API.md. */

export function createHttpApi(
  baseUrl: string,
  getToken: () => string | null,
  onUnauthorized: () => void,
  deviceKey: string | null = null,
): HelpDeskApi {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", ...extra };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, "სერვერთან კავშირი ვერ დამყარდა. შეამოწმე მისამართი პარამეტრებში.");
    }

    // 401 with a token = the session expired. Without one (the login request) it means wrong
    // credentials, which falls through so the server's own message is shown.
    if (res.status === 401 && headers.Authorization) {
      onUnauthorized();
      throw new ApiError(401, "სესია ამოიწურა. შედი თავიდან.");
    }
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, detail);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const qs = (params: object) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) v.forEach((x) => s.append(k, String(x)));
      else if (v !== undefined && v !== "" && v !== null) s.set(k, String(v));
    }
    const str = s.toString();
    return str ? `?${str}` : "";
  };

  return {
    login: (email, password, remember) => request<LoginResult>("POST", "/api/auth/login", { email, password, remember }),
    deviceSession: (device) => request<LoginResult>("POST", "/api/device/session", device, { "X-Device-Key": deviceKey ?? "" }),
    me: () => request<User>("GET", "/api/auth/me"),
    listTickets: (query: TicketQuery) => request<Ticket[]>("GET", `/api/tickets${qs(query)}`),
    getTicket: (id) => request<TicketDetail>("GET", `/api/tickets/${id}`),
    createTicket: (data: NewTicket) => request<Ticket>("POST", "/api/tickets", data),
    updateTicket: (id, patch: TicketPatch) => request<Ticket>("PATCH", `/api/tickets/${id}`, patch),
    delegate: (id, assignee_id, note) => request<Ticket>("POST", `/api/tickets/${id}/delegate`, { assignee_id, note }),
    returnToDispatch: (id, note) => request<Ticket>("POST", `/api/tickets/${id}/return`, { note }),
    addComment: (id, body) => request<TicketComment>("POST", `/api/tickets/${id}/comments`, { body }),
    listReplies: () => request<CannedReply[]>("GET", "/api/replies"),
    createReply: (reply) => request<CannedReply>("POST", "/api/replies", reply),
    updateReply: (id, reply) => request<CannedReply>("PATCH", `/api/replies/${id}`, reply),
    deleteReply: (id) => request<void>("DELETE", `/api/replies/${id}`),
    listAgents: () => request<Agent[]>("GET", "/api/agents"),
    listAudit: (query: AuditQuery) => request<AuditEntry[]>("GET", `/api/audit${qs(query)}`),
    report: (query: ReportQuery) => request<Report>("GET", `/api/reports${qs(query)}`),
    stats: () => request<Stats>("GET", "/api/stats"),
    slaPolicy: () => request<SlaPolicy>("GET", "/api/sla"),
    setSlaPolicy: (hours) => request<SlaPolicy>("PUT", "/api/sla", { hours }),
    teamReport: (query: ReportQuery) => request<TeamReport>("GET", `/api/sla/team${qs(query)}`),

    userEvents: (sam, hours, category) =>
      request<LogEvent[]>("GET", `/api/v1/eventlogs/user/${encodeURIComponent(sam)}${qs({ hours, category, limit: 1000 })}`),
    userDay: (sam, date) => request("GET", `/api/v1/eventlogs/user/${encodeURIComponent(sam)}/day${qs({ date })}`),
    userSessions: (sam, hours) => request<LogSession[]>("GET", `/api/v1/eventlogs/user/${encodeURIComponent(sam)}/sessions${qs({ hours })}`),
  };
}
