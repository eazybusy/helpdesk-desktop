// Shapes shared with the FastAPI backend. See API.md for the endpoint contract.

export type Role = "user" | "agent" | "admin";

export interface User {
  id: number;
  /** sAMAccountName — also the key the Event Log pipeline uses. */
  username: string;
  full_name: string;
  role: Role;
  department?: string | null;
}

/** IT staff member as listed for assignment, with their current workload. */
export interface Agent extends User {
  active_count: number;
}

/** Three states only: ახალი → მუშავდება → დასრულებული. */
export type TicketStatus = "new" | "open" | "closed";
export type TicketCategory = "hardware" | "printer" | "network" | "email" | "software" | "access" | "other";

export interface Device {
  /** Full DNS host name, e.g. reg-mtskheta-lashaberadze. Region is parsed from this. */
  hostname: string;
  /** NetBIOS name (%COMPUTERNAME%, max 15 chars). The Event Log agent reports under this name. */
  netbios?: string | null;
  username: string;
  domain?: string | null;
  ip?: string | null;
  os?: string | null;
}

// ===================================================================
//  Computer state captured on the requester's PC when the ticket is opened
// ===================================================================

export type DiskMedia = "HDD" | "SSD" | "NVMe" | "Unknown";
export type DiskHealth = "Healthy" | "Warning" | "Unhealthy" | "Unknown";

export interface PhysicalDisk {
  model: string;
  media: DiskMedia;
  bus: string;
  size_gb: number;
  health: DiskHealth;
  /** SSD wear, percent used. Needs admin rights on the client, so often null. */
  wear_percent: number | null;
  temperature_c: number | null;
}

export interface Volume {
  letter: string;
  label: string | null;
  total_gb: number;
  free_gb: number;
}

export type PrinterState =
  | "ready"
  | "printing"
  | "offline"
  | "paused"
  | "error"
  | "paper_jam"
  | "no_paper"
  | "low_toner"
  | "no_toner"
  | "door_open"
  | "unknown";

export interface Printer {
  name: string;
  state: PrinterState;
  is_default: boolean;
  is_network: boolean;
  port: string | null;
  driver: string | null;
  jobs: number;
  /** TCP/IP printers only: did the printer answer a ping. */
  reachable: boolean | null;
  /** PDF, XPS, OneNote, Fax. */
  virtual: boolean;
}

export type IssueLevel = "error" | "warning";
export interface Issue {
  level: IssueLevel;
  area: "cpu" | "memory" | "disk" | "volume" | "uptime" | "printer";
  text: string;
}

export interface DeviceSnapshot {
  captured_at: string;
  cpu: { name: string; cores: number; threads: number; load_percent: number };
  memory: { total_gb: number; used_gb: number };
  disks: PhysicalDisk[];
  volumes: Volume[];
  uptime_hours: number;
  printers: Printer[];
  /** Computed on the client (lib/health.ts) at capture time; the server stores them as-is. */
  issues: Issue[];
}

// ===================================================================
//  Event Log — shapes returned by eventlog-pipeline (server/schemas.py)
// ===================================================================

export type SamSource = "event" | "session" | "sid" | "console";

export interface LogEvent {
  id: number;
  computer: string;
  channel: string;
  provider: string | null;
  event_id: number;
  /** Windows level: 1 Critical, 2 Error, 3 Warning, 4 Information, 0 LogAlways. */
  level: number;
  time_created: string;
  time_local: string | null;
  user_name: string | null;
  sam: string | null;
  sam_source: SamSource | null;
  category: string | null;
  category_label: string | null;
  object_name: string | null;
  device_id: string | null;
  process_name: string | null;
  occurrences: number;
  message: string | null;
  data: Record<string, unknown> | null;
  problem_code: string | null;
  /** Rule severity: 1 critical, 2 error, 3 warning. */
  severity: number | null;
}

export interface LogProblem {
  code: string;
  title: string;
  category: string;
  severity: number;
  advice: string;
  count: number;
  first_seen: string | null;
  last_seen: string | null;
  computers: string[];
  samples: string[];
}

export interface FileActivity {
  time: string | null;
  time_local: string | null;
  sam: string | null;
  computer: string | null;
  object_name: string | null;
  process_name: string | null;
}

export interface AttachedDevice {
  time: string | null;
  time_local: string | null;
  sam: string | null;
  computer: string | null;
  device_id: string | null;
  kind: string;
  kind_label: string;
  flagged: boolean;
}

export interface LogFlag {
  code: string;
  severity: number;
  title: string;
  advice: string;
}

export interface LogActivity {
  counts: Record<string, number>;
  counts_labeled: Record<string, number>;
  deleted_files: FileActivity[];
  transferred_files: FileActivity[];
  devices: AttachedDevice[];
  flags: LogFlag[];
}

/** `TicketSnapshot` from the pipeline — stored on the ticket as `log_snapshot`. */
export interface LogSnapshot {
  sam: string;
  window_hours: number;
  generated_at: string;
  generated_at_local: string | null;
  computers: string[];
  problems: LogProblem[];
  activity: LogActivity;
  events: LogEvent[];
  summary: string;
  text: string;
}

export interface LogSession {
  computer: string;
  sam: string;
  user_name: string | null;
  logon_type: number | null;
  start_time: string;
  end_time: string | null;
  start_local: string | null;
  end_local: string | null;
}

// ===================================================================
//  Tickets
// ===================================================================

export interface Ticket {
  id: number;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  requester: User;
  assignee: User | null;
  device: Device;
  /** Region slug parsed by the server from reg-<region>-<user> host names. */
  region: string | null;
  delegated_by: User | null;
  delegation_note: string | null;
  /** Who closed the ticket (null while it is active). Shown in the employee's notification. */
  resolved_by: User | null;
  /** One line from the Event Log pipeline (`summary`), IT only. */
  suspected_problem: string | null;
  created_at: string;
  updated_at: string;
  due_at: string | null;
  /** `len(snapshot.issues)` — problems found on the computer. */
  issue_count: number;
  /** Comments IT wrote on the ticket; the employee is notified when this grows. */
  comment_count: number;
  last_comment: { author: User; body: string; at: string } | null;
}

/** A note from IT (specialist or admin) on a ticket. The employee sees it in the app and gets a notification. */
export interface TicketComment {
  id: number;
  author: User;
  body: string;
  at: string;
}

/**
 * A ready-made reply for comments, shared by the IT team. Placeholders filled in when inserted:
 * {სახელი} = the employee's first name, {ნომერი} = the ticket number.
 */
export interface CannedReply {
  id: number;
  title: string;
  body: string;
  author: User;
  updated_at: string;
}

/**
 * taken      — an IT specialist took a free ticket himself
 * assigned   — the admin gave an unassigned ticket to someone
 * reassigned — the admin moved a ticket from one person to another
 * delegated  — the admin routed a regional ticket (from = previous holder, if any)
 * returned   — the holder gave it back (regional → dispatch, other → free queue)
 * commented  — IT wrote a comment (value = its first 140 characters; the text itself is in `comments`)
 */
export type HistoryKind =
  | "created"
  | "taken"
  | "assigned"
  | "reassigned"
  | "delegated"
  | "unassigned"
  | "returned"
  | "status"
  | "category"
  | "commented";

/** Kinds that change who is responsible for a ticket. */
export const ASSIGNMENT_KINDS: HistoryKind[] = ["taken", "assigned", "reassigned", "delegated", "unassigned", "returned"];

export interface HistoryEntry {
  id: number;
  at: string;
  actor: User | null;
  kind: HistoryKind;
  value?: string | null;
  /** New holder (assignment kinds). */
  assignee?: User | null;
  /** Previous holder (reassigned, delegated, unassigned, returned). */
  from?: User | null;
  note?: string | null;
}

/** One row of the admin's audit journal: every history entry of every ticket, append-only on the server. */
export interface AuditEntry {
  id: number;
  at: string;
  actor: User | null;
  action: HistoryKind;
  ticket: { id: number; subject: string; region: string | null };
  from: User | null;
  to: User | null;
  value: string | null;
  note: string | null;
  /** Where the action came from, recorded by the server. */
  ip: string | null;
  client: "web" | "desktop" | "agent" | null;
}

export interface AuditQuery {
  /** "assignment" = ASSIGNMENT_KINDS only. */
  action?: "assignment" | HistoryKind;
  /** Actor, previous or new holder. */
  person_id?: number;
  /** ISO time; entries at or after it. */
  since?: string;
  /** Ticket number or subject. */
  q?: string;
  limit?: number;
}

/**
 * RustDesk access to the requester's PC. The ID comes from the app with the ticket; a fresh
 * permanent password is set by the SYSTEM task on that PC (deploy/RemoteAccess.ps1) and sent
 * straight to the server, so the employee never sees it. Staff only.
 */
export interface RemoteAccess {
  rustdesk_id: string | null;
  password: string | null;
  /** When the password was set on the PC. */
  updated_at: string | null;
}

export interface TicketDetail extends Ticket {
  snapshot: DeviceSnapshot | null;
  remote: RemoteAccess | null;
  /** IT only; null for requesters. */
  log_snapshot: LogSnapshot | null;
  history: HistoryEntry[];
  /** Oldest first. Visible to the employee too. */
  comments: TicketComment[];
}

/**
 * For an admin these count the whole service. For an agent they are personal:
 * `mine`/`overdue`/`resolved_today` cover their own tickets, `unassigned` the free queue.
 */
export interface Stats {
  new: number;
  open: number;
  overdue: number;
  resolved_today: number;
  mine: number;
  unassigned: number;
  /** Regional tickets waiting for delegation (admins only; 0 for agents). */
  dispatch: number;
  avg_first_response_minutes: number | null;
  /** Admin only: workload per IT specialist. */
  team: { agent: User; active: number; overdue: number; closed_today: number }[];
  by_region: { region: string; count: number }[];
  /** Admin: active tickets from head office vs regions (regional includes those waiting for delegation). */
  by_origin: { hq: number; region: number };
  daily: { date: string; created: number; resolved: number }[];
}

export type TicketScope = "all" | "mine" | "unassigned" | "dispatch" | "requested" | "closed";

/** Head office (სათავო) or a regional office, decided by the computer name (reg-<region>-*). */
export type Origin = "hq" | "region";

export interface TicketQuery {
  scope?: TicketScope;
  /** Admin: only head-office or only regional tickets. */
  origin?: Origin;
  status?: TicketStatus;
  region?: string;
  q?: string;
}

export interface ReportQuery {
  /** ISO time, inclusive. */
  since: string;
  /** ISO time, exclusive. Default: now. */
  until?: string;
  origin?: Origin;
  region?: string;
}

/**
 * Who got which tickets in a period, from the history (ticket_history): what the admin handed out,
 * and tickets that went from one person to another (and maybe back).
 */
export interface Handoffs {
  /** Admin's assignments in the period: assigned, reassigned and delegated by an admin. */
  by_admin: number;
  /** Of all assignment moves, those that took a ticket away from someone (reassigned, or delegated over a holder). */
  moved: number;
  /** Per IT person. received: given to them by the admin; taken: took it themselves; moved_away: given to someone else; returned: gave it back. */
  per_agent: { agent: User; received: number; taken: number; moved_away: number; returned: number }[];
  /** Tickets whose holder changed more than once in the period, most changes first (at most 30). */
  chains: {
    ticket: { id: number; subject: string; region: string | null; status: TicketStatus };
    steps: { at: string; kind: HistoryKind; by: User | null; to: User | null; from: User | null }[];
  }[];
}

/** Admin report: counts and the most frequent requests/problems for a period. Computed by the server over all tickets. */
export interface Report {
  since: string;
  until: string;
  totals: {
    /** Tickets opened in the period. */
    opened: number;
    /** Opened in the period and closed by now. */
    resolved: number;
    /** Active right now (whatever the period). */
    open_now: number;
    /** Closed after the ticket's deadline (due_at). */
    late: number;
    avg_resolution_minutes: number | null;
    avg_first_response_minutes: number | null;
  };
  by_origin: { hq: number; region: number };
  by_region: { region: string; opened: number; resolved: number }[];
  by_category: { category: TicketCategory; opened: number; avg_resolution_minutes: number | null }[];
  /** "Which request is opened most often": tickets grouped by normalised subject. */
  top_subjects: { subject: string; category: TicketCategory; count: number }[];
  /** "Which problem is most common": the Event Log analysis (suspected_problem) grouped. */
  top_problems: { problem: string; count: number }[];
  /** Computers with the most tickets. */
  top_devices: { hostname: string; requester: User | null; region: string | null; count: number }[];
  by_agent: { agent: User; resolved: number; avg_resolution_minutes: number | null }[];
  /** Per day, or per week (date = Monday) when the period is longer than 45 days. */
  trend: { date: string; created: number; resolved: number }[];
  trend_unit: "day" | "week";
  handoffs: Handoffs;
}

/**
 * Deadlines (SLA), set by the admin per category. A new ticket gets due_at = created_at + hours of
 * its category; a category change recomputes it from created_at. Changing the policy affects new
 * tickets only, so a deadline never moves under someone's feet.
 */
export interface SlaPolicy {
  hours: Record<TicketCategory, number>;
  updated_at: string | null;
  updated_by: User | null;
}

/** Admin SLA page: who closed how many, and what comes up most often, for a period. */
export interface TeamReport {
  since: string;
  until: string;
  /** Opened in the period (since ≤ created_at < until). */
  opened: number;
  /** Closed in the period (since ≤ resolved_at < until). */
  closed: number;
  avg_resolution_minutes: number | null;
  /** Everyone who closed tickets in the period (IT specialists and the admin), most first. */
  by_agent: { agent: User; closed: number; avg_resolution_minutes: number | null; by_category: Partial<Record<TicketCategory, number>> }[];
  /** Event Log problems of the tickets opened in the period, most frequent first. */
  top_problems: { problem: string; count: number }[];
  /** What people asked for most (normalised subject) in the period. */
  top_subjects: { subject: string; category: TicketCategory; count: number }[];
  handoffs: Handoffs;
}

export interface NewTicket {
  subject: string;
  description: string;
  category: TicketCategory;
  device: Device;
  snapshot: DeviceSnapshot | null;
  /** RustDesk ID read on the PC (`rustdesk.exe --get-id`); null when RustDesk isn't installed. */
  remote_id: string | null;
}

export interface TicketPatch {
  status?: TicketStatus;
  category?: TicketCategory;
  assignee_id?: number | null;
}

export interface LoginResult {
  access_token: string;
  user: User;
}
