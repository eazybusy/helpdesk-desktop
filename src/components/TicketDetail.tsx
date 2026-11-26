import { useState, type ReactNode } from "react";
import { CheckCircle2, Copy, LayoutList, MapPin, Monitor, MonitorSmartphone, ScrollText, Undo2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAgents, useDelegate, useReturnToDispatch, useTicket, useUpdateTicket } from "@/api/queries";
import { dateTime, relative, ticketNo } from "@/lib/format";
import { CATEGORY, CATEGORY_ORDER, STATUS, STATUS_ORDER, regionName } from "@/lib/labels";
import type { TicketDetail as TD, User } from "@/lib/types";
import { isStaff } from "@/store/session";
import { DevicePanel } from "./DevicePanel";
import { EventLogPanel } from "./EventLogPanel";
import { RemoteAccess } from "./RemoteAccess";
import { TicketOverview } from "./TicketOverview";
import { Dropdown } from "./ui/Dropdown";
import { Deadline } from "./ui/deadline";
import { Avatar, StatusGlyph, StatusLabel } from "./ui/marks";
import { Button, Count, Empty, IconButton, Skeleton, cn } from "./ui/primitives";

type Tab = "overview" | "device" | "events";

export function TicketDetail({ id, viewer }: { id: number; viewer: User }) {
  const { data: t, isLoading, error } = useTicket(id);
  const [tab, setTab] = useState<Tab>("overview");
  const staff = isStaff(viewer);

  if (isLoading) return <DetailSkeleton />;
  if (error || !t) return <Empty title="მოთხოვნა ვერ ჩაიტვირთა">{error instanceof Error ? error.message : null}</Empty>;

  const problems = t.log_snapshot ? t.log_snapshot.problems.length + t.log_snapshot.activity.flags.length : 0;

  return (
    <div className="@container/detail flex h-full min-w-0">
      <section className="@container/main flex min-w-0 flex-1 flex-col">
        <header className="min-w-0 border-b border-line px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5 text-[12.5px] whitespace-nowrap text-ink-3">
            <span className="tnum">{ticketNo(t.id)}</span>
            {t.region && (
              <span className="inline-flex items-center gap-1 font-medium text-accent">
                <MapPin className="size-3" />
                {regionName(t.region)}
              </span>
            )}
            <span>{CATEGORY[t.category]}</span>
            <span title={dateTime(t.created_at)}>{relative(t.created_at)}</span>
          </div>
          <h1 data-selectable className="display mt-1.5 text-[20px] leading-snug">{t.subject}</h1>

          {staff ? (
            <div className="mt-4 flex w-fit max-w-full gap-0.5 rounded-[10px] bg-sunken p-[3px] shadow-[inset_0_1px_2px_rgb(13_27_42/0.06)]">
              <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
                <LayoutList />
                <span className="truncate">მიმოხილვა</span>
              </TabButton>
              <TabButton active={tab === "device"} onClick={() => setTab("device")}>
                <Monitor />
                <span className="truncate">კომპიუტერი</span>
                {t.issue_count > 0 && <Count tone="warn">{t.issue_count}</Count>}
              </TabButton>
              <TabButton active={tab === "events"} onClick={() => setTab("events")}>
                <ScrollText />
                <span className="truncate">Event Log</span>
                {problems > 0 && <Count tone="warn">{problems}</Count>}
              </TabButton>
            </div>
          ) : null}
        </header>

        {tab === "overview" && (
          <TicketOverview
            t={t}
            viewer={viewer}
            onOpen={setTab}
            // Narrow windows: no room for a third column, so the properties move to the top of the overview.
            top={
              <div className="hidden @max-[720px]/detail:block">
                <Properties t={t} viewer={viewer} inline />
              </div>
            }
          />
        )}
        {tab === "device" && <DevicePanel snapshot={t.snapshot} />}
        {tab === "events" && <EventLogPanel snapshot={t.log_snapshot} sam={t.requester.username} />}
      </section>

      {/* The analysis tabs need the width; ticket properties live on the overview. */}
      {(tab === "overview" || !staff) && (
        <aside className="w-[272px] shrink-0 overflow-y-auto border-l border-line bg-[color-mix(in_srgb,var(--sunken)_55%,transparent)] px-5 py-5 @max-[720px]/detail:hidden">
          <Properties t={t} viewer={viewer} />
        </aside>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 min-w-0 shrink items-center gap-1.5 rounded-[7px] px-3 text-[13px] whitespace-nowrap transition-[background-color,box-shadow,color] duration-150 @max-[460px]/main:px-2 [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:stroke-[1.9] @max-[460px]/main:[&>svg]:hidden",
        active ? "bg-raised font-medium text-ink shadow-tab [&>svg]:text-accent" : "text-ink-2 hover:bg-raised/50 hover:text-ink [&>svg]:text-ink-3",
      )}
    >
      {children}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 px-6 py-6" aria-busy>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-5 w-[60%]" />
      <Skeleton className="h-8 w-72 rounded-[10px]" />
      <div className="space-y-2.5 pt-4">
        <Skeleton className="h-3.5 w-[85%]" />
        <Skeleton className="h-3.5 w-[70%]" />
        <Skeleton className="h-3.5 w-[50%]" />
      </div>
    </div>
  );
}

function Properties({ t, viewer, inline }: { t: TD; viewer: User; inline?: boolean }) {
  const staff = isStaff(viewer);
  const admin = viewer.role === "admin";
  const mine = t.assignee?.id === viewer.id;
  const free = !t.assignee && !t.region;
  const update = useUpdateTicket(t.id);
  const delegate = useDelegate(t.id);
  const back = useReturnToDispatch(t.id);
  const agents = useAgents(admin);
  const done = t.status === "closed";
  // IT specialists only move their own tickets between working states; everything else is the admin's call.
  const statusOptions = admin ? STATUS_ORDER : (["open", "closed"] as const);
  const canStatus = admin || (staff && mine && t.status !== "closed");

  const set = (patch: Parameters<typeof update.mutate>[0], msg: string) => update.mutate(patch, { onSuccess: () => toast.success(msg) });
  const assign = (v: number | null) => {
    if (t.region && v) delegate.mutate({ assigneeId: v, note: "" }, { onSuccess: () => toast.success("გადაეწერა") });
    else set({ assignee_id: v }, v ? "შემსრულებელი შეიცვალა" : "შემსრულებელი მოიხსნა");
  };

  return (
    <div className={cn(inline && "rounded-panel border border-line bg-raised p-4 shadow-card")}>
      {staff && (
        <div className="mb-5 flex items-center gap-2.5">
          <Avatar user={t.requester} size={32} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13.5px] font-medium">{t.requester.full_name}</p>
            <p className="truncate text-[12px] text-ink-3">{t.requester.department ?? t.requester.username}</p>
          </div>
        </div>
      )}

      {staff && !done && t.due_at && <Deadline created={t.created_at} due={t.due_at} variant="detail" className="mb-4" />}

      <dl className={inline ? "grid grid-cols-2 gap-x-6 gap-y-1" : "space-y-1"}>
        <Prop stacked={inline} label="სტატუსი">
          {canStatus ? (
            <Dropdown
              appearance="inline"
              label="სტატუსი"
              align="right"
              value={t.status}
              onChange={(v) => set({ status: v }, `სტატუსი: ${STATUS[v]}`)}
              options={statusOptions.map((s) => ({ value: s, label: STATUS[s], icon: <StatusGlyph status={s} /> }))}
            />
          ) : (
            <StatusLabel status={t.status} />
          )}
        </Prop>
        <Prop stacked={inline} label="კატეგორია">
          {admin ? (
            <Dropdown appearance="inline" label="კატეგორია" align="right" value={t.category} onChange={(v) => set({ category: v }, `კატეგორია: ${CATEGORY[v]}`)} options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY[c] }))} />
          ) : (
            <span className="text-[13px]">{CATEGORY[t.category]}</span>
          )}
        </Prop>
        <Prop stacked={inline} label="შემსრულებელი">
          {admin ? (
            <Dropdown<number | null>
              appearance="inline"
              label="შემსრულებელი"
              align="right"
              value={t.assignee?.id ?? null}
              onChange={assign}
              options={[
                { value: null, label: t.region ? "გასანაწილებელი" : "არავინ" },
                ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.full_name, hint: `${a.active_count} აქტიური`, icon: <Avatar user={a} size={18} /> })),
              ]}
            />
          ) : (
            <span className="truncate text-[13px]">{mine ? "შენ" : (t.assignee?.full_name ?? "ჯერ არავინ")}</span>
          )}
        </Prop>
        {t.region && (
          <Prop stacked={inline} label="რეგიონი">
            <span className="text-[13px]">{regionName(t.region)}</span>
          </Prop>
        )}
      </dl>

      {staff && !done && (
        <div className={cn("mt-4 flex gap-1.5", inline ? "flex-wrap" : "flex-col")}>
          {free && !mine && (
            <Button variant="primary" onClick={() => set({ assignee_id: viewer.id }, "მოთხოვნა შენზეა")} icon={<UserPlus className="size-3.5" />}>
              ჩემზე აღება
            </Button>
          )}
          {(mine || admin) && (t.assignee || !t.region) && (
            <Button onClick={() => set({ status: "closed" }, "მოთხოვნა დასრულდა")} icon={<CheckCircle2 className="size-3.5" />}>
              დასრულება
            </Button>
          )}
          {!admin && mine && (
            <Button variant="ghost" onClick={() => back.mutate("", { onSuccess: () => toast.success(t.region ? "დაუბრუნდა ადმინს" : "დაბრუნდა შემოსულებში") })} icon={<Undo2 className="size-3.5" />}>
              {t.region ? "ადმინისთვის დაბრუნება" : "რიგში დაბრუნება"}
            </Button>
          )}
        </div>
      )}

      <div className={cn("border-t border-line pt-4", inline ? "mt-4" : "mt-6")}>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
          <MonitorSmartphone className="size-3.5" />
          კომპიუტერი
        </h3>
        <dl className={inline ? "grid grid-cols-2 gap-x-6 gap-y-2" : "space-y-2"}>
          <Copyable label="სახელი" value={t.device.hostname} />
          <Copyable label="IP მისამართი" value={t.device.ip} />
          <Copyable label="მომხმარებელი" value={t.device.domain ? `${t.device.domain.split(".")[0]}\\${t.device.username}` : t.device.username} />
          <Copyable label="სისტემა" value={t.device.os} />
        </dl>
      </div>

      {staff && t.remote && <RemoteAccess remote={t.remote} createdAt={t.created_at} inline={inline} />}
    </div>
  );
}

function Prop({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  // Stacked (label above value) in the narrow inline layout, where two columns leave no room for side labels.
  return stacked ? (
    <div className="min-w-0 py-1 pl-2">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 min-w-0">{children}</dd>
    </div>
  ) : (
    <div className="grid min-h-7 grid-cols-[112px_1fr] items-center gap-2">
      <dt className="text-[12.5px] text-ink-2">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Copyable({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="group">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="flex items-center gap-1">
        <span data-selectable className="tnum min-w-0 flex-1 truncate text-[13px]" title={value}>{value}</span>
        <IconButton
          label={`${label}: კოპირება`}
          className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => navigator.clipboard.writeText(value).then(() => toast.success(`${label} დაკოპირდა`), () => {})}
        >
          <Copy className="size-3" />
        </IconButton>
      </dd>
    </div>
  );
}
