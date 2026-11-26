import { useState } from "react";
import { ArrowRight, Lightbulb, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAgents, useDelegate } from "@/api/queries";
import { dateTime, relative } from "@/lib/format";
import { CATEGORY, STATUS, regionName } from "@/lib/labels";
import type { HistoryEntry, TicketCategory, TicketDetail, TicketStatus, User } from "@/lib/types";
import { isStaff } from "@/store/session";
import { IssueList } from "./DevicePanel";
import { Dropdown } from "./ui/Dropdown";
import { Avatar } from "./ui/marks";
import { Button, Input } from "./ui/primitives";

export function TicketOverview({
  t,
  viewer,
  onOpen,
  top,
}: {
  t: TicketDetail;
  viewer: User;
  onOpen: (tab: "device" | "events") => void;
  top?: React.ReactNode;
}) {
  const staff = isStaff(viewer);
  const admin = viewer.role === "admin";
  const awaiting = !!t.region && !t.assignee && t.status !== "closed";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-[720px] space-y-6">
        {top}
        {admin && awaiting && <DelegateCard t={t} />}
        {staff && !admin && t.delegated_by && t.assignee?.id === viewer.id && <DelegatedToMe t={t} />}

        <section>
          <SectionTitle>აღწერა</SectionTitle>
          <article className="rounded-[12px] border border-line bg-[color-mix(in_srgb,var(--sunken)_55%,transparent)] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Avatar user={t.requester} size={22} />
              <span className="text-[13px] font-medium">{t.requester.id === viewer.id ? "შენ" : t.requester.full_name}</span>
              <time className="text-[12px] text-ink-3" title={dateTime(t.created_at)}>{relative(t.created_at)}</time>
            </div>
            <p data-selectable className="mt-2 text-[14.5px] leading-[1.7] whitespace-pre-wrap">{t.description}</p>
          </article>
        </section>

        {staff && t.suspected_problem && (
          <button onClick={() => onOpen("events")} className="flex w-full gap-3 rounded-[10px] border border-line bg-raised px-3.5 py-3 text-left transition-colors hover:border-line-strong">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-high" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-ink-3">Event Log, ბოლო 24 საათი</span>
              <span className="block text-[13.5px] leading-snug">{t.suspected_problem}</span>
            </span>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-ink-3" />
          </button>
        )}

        {staff && t.snapshot && t.snapshot.issues.length > 0 && (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[12.5px] font-medium text-ink-2">კომპიუტერი მოთხოვნის გახსნისას</h3>
              <button onClick={() => onOpen("device")} className="text-[12.5px] font-medium text-accent hover:underline">სრულად</button>
            </div>
            <IssueList issues={t.snapshot.issues.slice(0, 4)} compact />
          </div>
        )}

        <History items={t.history} viewer={viewer} />
      </div>
    </div>
  );
}

function DelegateCard({ t }: { t: TicketDetail }) {
  const agents = useAgents();
  const delegate = useDelegate(t.id);
  const [who, setWho] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const submit = () => {
    if (!who) return;
    const name = agents.data?.find((a) => a.id === who)?.full_name;
    delegate.mutate({ assigneeId: who, note }, { onSuccess: () => toast.success(`გადაეწერა: ${name}`) });
  };

  return (
    <section className="rounded-[12px] border border-accent/40 bg-accent-soft/60 p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium">
        <MapPin className="size-3.5 text-accent" />
        რეგიონული მოთხოვნა, {regionName(t.region!)}
      </p>
      <p className="mt-0.5 text-[12.5px] text-ink-2">ელოდება შენს გადაწყვეტილებას: ვის გადაეწეროს.</p>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Dropdown<number | null>
          label="შემსრულებელი"
          value={who}
          onChange={setWho}
          options={[
            { value: null, label: "აირჩიე შემსრულებელი" },
            ...(agents.data ?? []).map((a) => ({
              value: a.id,
              label: a.full_name,
              hint: a.active_count ? `${a.active_count} აქტიური მოთხოვნა` : "თავისუფალია",
              icon: <Avatar user={a} size={18} />,
            })),
          ]}
        />
        <Button variant="primary" onClick={submit} disabled={!who} loading={delegate.isPending}>
          გადაწერა
        </Button>
        <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="მითითება შემსრულებლისთვის (არასავალდებულო)" className="col-span-2" />
      </div>
    </section>
  );
}

function DelegatedToMe({ t }: { t: TicketDetail }) {
  return (
    <section className="rounded-[12px] border border-line bg-raised px-4 py-3">
      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
        <MapPin className="size-3.5 text-accent" />
        {t.region ? `${regionName(t.region)}, ` : ""}{t.delegated_by!.full_name}-მ გადმოგაწერა
      </p>
      {t.delegation_note && <p data-selectable className="mt-1 text-[13.5px] leading-relaxed">{t.delegation_note}</p>}
    </section>
  );
}

function History({ items, viewer }: { items: HistoryEntry[]; viewer: User }) {
  if (!items.length) return null;
  return (
    <section className="border-t border-line pt-5">
      <SectionTitle>ისტორია</SectionTitle>
      <ol className="relative space-y-3 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-line">
        {items.map((h) => (
          <li key={h.id} className="relative flex gap-3 pl-5 text-[13px]">
            <span className="absolute top-[7px] left-[2px] size-[7px] rounded-full border border-line-strong bg-panel" />
            <div className="min-w-0 flex-1">
              <p className="leading-snug">{describe(h, viewer)}</p>
              {h.note && <p data-selectable className="mt-0.5 text-[12.5px] text-ink-2">„{h.note}“</p>}
            </div>
            <time className="shrink-0 text-[12px] text-ink-3" title={dateTime(h.at)}>{relative(h.at)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}

function describe(h: HistoryEntry, viewer: User) {
  const name = (x: User | null | undefined) => (x ? (x.id === viewer.id ? "შენ" : x.full_name) : "");
  const who = h.actor ? name(h.actor) : "სისტემა";
  const to = name(h.assignee);
  const from = name(h.from);
  switch (h.kind) {
    case "created": return `${who}: მოთხოვნა შეიქმნა`;
    case "taken": return `${to || who}: აიღო მოთხოვნა`;
    case "delegated": return from ? `${who}: გადაწერა ${from} → ${to}` : `${who} → ${to}: გადაწერა`;
    case "assigned": return h.actor?.id === h.assignee?.id ? `${to}: აიღო მოთხოვნა` : `${who} → ${to}: მიწერა`;
    case "reassigned": return `${who}: გადაწერა ${from} → ${to}`;
    case "unassigned": return from ? `${who}: მოხსნა ${from}` : `${who}: შემსრულებელი მოიხსნა`;
    case "returned": return `${who}: დააბრუნა`;
    case "status": return `${who}: სტატუსი „${STATUS[h.value as TicketStatus] ?? h.value}“`;
    case "category": return `${who}: კატეგორია „${CATEGORY[h.value as TicketCategory] ?? h.value}“`;
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-ink-3">{children}</h3>;
}
