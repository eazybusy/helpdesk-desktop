import { useMemo, useState, type ReactNode } from "react";
import { AlertOctagon, AlertTriangle, ChevronRight, Copy, FileX2, Info, Search, Usb, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useUserDay, useUserEvents, useUserSessions } from "@/api/queries";
import { localDate } from "@/lib/format";
import { LOG_CATEGORY, LOG_LEVEL, SAM_SOURCE } from "@/lib/labels";
import type { LogEvent, LogProblem, LogSnapshot } from "@/lib/types";
import { Dropdown } from "./ui/Dropdown";
import { Empty, IconButton, Input, Segmented, Spinner, cn } from "./ui/primitives";

type Sub = "summary" | "events" | "activity" | "sessions";

/** "2026-11-04 17:19:05" (pipeline time_local) → "04.11 17:19" */
const short = (local: string | null | undefined) => (local ? `${local.slice(8, 10)}.${local.slice(5, 7)} ${local.slice(11, 16)}` : "—");

const copy = (text: string, msg: string) =>
  navigator.clipboard.writeText(text).then(() => toast.success(msg), () => toast.error("კოპირება ვერ მოხერხდა"));

/** Shows the eventlog-pipeline snapshot attached to the ticket, plus live queries for other periods. */
export function EventLogPanel({ snapshot, sam }: { snapshot: LogSnapshot | null; sam: string }) {
  const [sub, setSub] = useState<Sub>("summary");
  const [focus, setFocus] = useState<{ category?: string; problem?: string } | null>(null);

  if (!snapshot)
    return (
      <Empty title="Event Log არ მიმაგრებულა">
        ამ მომხმარებლის კომპიუტერიდან ჟურნალი ჯერ არ მოსულა. შეამოწმე აგენტის Scheduled Task და <code>/agents/health</code>.
      </Empty>
    );

  const drill = (f: { category?: string; problem?: string }) => {
    setFocus(f);
    setSub("events");
  };

  const a = snapshot.activity;
  const fileCount = a.deleted_files.length + a.transferred_files.length + a.devices.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-w-0 items-center gap-3 border-b border-line px-6 py-2.5">
        <Segmented<Sub>
          className="shrink-0"
          value={sub}
          onChange={(v) => {
            setSub(v);
            if (v !== "events") setFocus(null);
          }}
          options={[
            { value: "summary", label: "შეჯამება" },
            { value: "events", label: `ჩანაწერები ${snapshot.events.length}` },
            { value: "activity", label: `ფაილები, USB${fileCount ? ` ${fileCount}` : ""}` },
            { value: "sessions", label: "სესიები" },
          ]}
        />
        <span className="ml-auto min-w-0 truncate text-[12px] text-ink-3" title={snapshot.computers.join(", ")}>
          {snapshot.sam}, {snapshot.computers.join(", ") || "—"}
        </span>
        <IconButton label="ტექსტის კოპირება" onClick={() => copy(snapshot.text, "ამონაწერი დაკოპირდა")}>
          <Copy className="size-3.5" />
        </IconButton>
      </div>

      {sub === "summary" && <Summary snap={snapshot} onDrill={drill} />}
      {sub === "events" && <Events snap={snapshot} sam={sam} focus={focus} onClearFocus={() => setFocus(null)} />}
      {sub === "activity" && <Activity snap={snapshot} />}
      {sub === "sessions" && <Sessions sam={sam} />}
    </div>
  );
}

// ---------------------------------------------------------------- summary

function sevIcon(sev: number | null | undefined, className = "size-3.5") {
  if (sev === 1) return <AlertOctagon className={cn(className, "text-critical")} />;
  if (sev === 2) return <XCircle className={cn(className, "text-critical")} />;
  if (sev === 3) return <AlertTriangle className={cn(className, "text-high")} />;
  return <Info className={cn(className, "text-ink-3")} />;
}
const levelToSev = (level: number) => (level === 1 ? 1 : level === 2 ? 2 : level === 3 ? 3 : null);

function Summary({ snap, onDrill }: { snap: LogSnapshot; onDrill: (f: { category?: string; problem?: string }) => void }) {
  const [open, setOpen] = useState<string | null>(snap.problems[0]?.code ?? null);
  const counts = Object.entries(snap.activity.counts);
  const max = Math.max(1, ...counts.map(([, v]) => v));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-[720px] space-y-6">
        <div>
          <p data-selectable className="display text-[16px] leading-snug">{snap.summary}</p>
          <p className="mt-1 text-[12px] text-ink-3">ბოლო {snap.window_hours} საათი, ამონაწერი აიწყო {snap.generated_at_local ?? "—"}</p>
        </div>

        {snap.activity.flags.length > 0 && (
          <ul className="space-y-2">
            {snap.activity.flags.map((f) => (
              <li key={f.code} className="flex gap-3 rounded-[10px] border border-critical/30 bg-critical/[0.06] px-3.5 py-2.5">
                {sevIcon(f.severity, "mt-0.5 size-4 shrink-0")}
                <div>
                  <p className="text-[13px] font-medium">{f.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-2">{f.advice}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section>
          <h3 className="mb-2 text-[12.5px] font-medium text-ink-2">სავარაუდო პრობლემები</h3>
          {snap.problems.length === 0 ? (
            <p className="text-[13px] text-ink-3">წესებს არცერთი ჩანაწერი არ დაემთხვა.</p>
          ) : (
            <ul className="divide-y divide-line rounded-[10px] border border-line bg-raised">
              {snap.problems.map((p) => (
                <ProblemRow key={p.code} p={p} open={open === p.code} onToggle={() => setOpen(open === p.code ? null : p.code)} onShow={() => onDrill({ problem: p.code })} />
              ))}
            </ul>
          )}
        </section>

        {counts.length > 0 && (
          <section>
            <h3 className="mb-2 text-[12.5px] font-medium text-ink-2">ჩანაწერები კატეგორიით</h3>
            <ul className="space-y-1">
              {counts.map(([k, v]) => (
                <li key={k}>
                  <button onClick={() => onDrill({ category: k })} className="grid w-full grid-cols-[190px_1fr_32px] items-center gap-3 rounded-ctl px-1.5 py-1 text-left text-[12.5px] hover:bg-sunken">
                    <span className="truncate text-ink-2">{LOG_CATEGORY[k] ?? k}</span>
                    <span className="h-2 rounded-r-[4px] bg-chart-1" style={{ width: `${(v / max) * 100}%` }} />
                    <span className="tnum text-right">{v}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ProblemRow({ p, open, onToggle, onShow }: { p: LogProblem; open: boolean; onToggle: () => void; onShow: () => void }) {
  return (
    <li>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-ink/[0.025]">
        {sevIcon(p.severity)}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.title}</span>
        <span className="tnum shrink-0 text-[12.5px] text-ink-2">{p.count}-ჯერ</span>
        <ChevronRight className={cn("size-3.5 shrink-0 text-ink-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="anim-fade space-y-2.5 px-3.5 pb-3 pl-[42px]">
          <p className="text-[13px] leading-relaxed"><span className="text-ink-3">რა ვქნა: </span>{p.advice}</p>
          {p.samples.map((s, i) => (
            <p key={i} data-selectable className="rounded-ctl border border-line bg-sunken px-2.5 py-1.5 text-[12px] leading-relaxed break-words text-ink-2">{s}</p>
          ))}
          <div className="flex items-center gap-3 text-[12px] text-ink-3">
            <span>{p.category}</span>
            <span>{p.code}</span>
            <button onClick={onShow} className="ml-auto font-medium text-accent hover:underline">ჩანაწერების ნახვა</button>
          </div>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- events

type Period = "snapshot" | "24" | "72" | "168" | "720" | "day";
const PERIODS: { value: Period; label: string }[] = [
  { value: "snapshot", label: "მოთხოვნისას, 24 სთ" },
  { value: "24", label: "ახლა: ბოლო 24 საათი" },
  { value: "72", label: "ბოლო 3 დღე" },
  { value: "168", label: "ბოლო 7 დღე" },
  { value: "720", label: "ბოლო 30 დღე" },
  { value: "day", label: "კონკრეტული დღე" },
];
const LEVEL_CHIPS = [
  { key: 1, label: "კრიტიკული" },
  { key: 2, label: "შეცდომა" },
  { key: 3, label: "გაფრთხილება" },
  { key: 4, label: "ინფორმაცია" },
];
const levelKey = (l: number) => (l >= 1 && l <= 3 ? l : 4);

function Events({ snap, sam, focus, onClearFocus }: { snap: LogSnapshot; sam: string; focus: { category?: string; problem?: string } | null; onClearFocus: () => void }) {
  const [period, setPeriod] = useState<Period>("snapshot");
  const [day, setDay] = useState(() => localDate());
  const [cats, setCats] = useState<Set<string>>(new Set(focus?.category ? [focus.category] : []));
  const [levels, setLevels] = useState<Set<number>>(new Set());
  const [factsOnly, setFactsOnly] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(!!focus?.problem);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const hours = period === "snapshot" || period === "day" ? 0 : Number(period);
  const live = useUserEvents(sam, hours);
  const dayQ = useUserDay(sam, period === "day" ? day : null);

  const source: LogEvent[] | undefined = period === "snapshot" ? snap.events : period === "day" ? dayQ.data?.events : live.data;
  const loading = period === "day" ? dayQ.isLoading : period !== "snapshot" && live.isLoading;

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of source ?? []) m.set(e.category ?? "other", (m.get(e.category ?? "other") ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [source]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (source ?? []).filter((e) => {
      if (cats.size && !cats.has(e.category ?? "other")) return false;
      if (levels.size && !levels.has(levelKey(e.level))) return false;
      if (factsOnly && !(e.sam_source && SAM_SOURCE[e.sam_source]?.fact)) return false;
      if (problemsOnly && !e.problem_code) return false;
      if (focus?.problem && problemsOnly && e.problem_code !== focus.problem) return false;
      if (needle && !`${e.provider} ${e.event_id} ${e.message} ${e.object_name} ${e.device_id} ${e.process_name} ${e.channel}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [source, cats, levels, factsOnly, problemsOnly, q, focus]);

  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };
  const anyFilter = cats.size > 0 || levels.size > 0 || factsOnly || problemsOnly || !!q;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-line px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="w-[190px]">
            <Dropdown<Period> label="პერიოდი" value={period} onChange={setPeriod} options={PERIODS} />
          </div>
          {period === "day" && (
            <Input type="date" value={day} max={localDate()} onChange={(e) => setDay(e.target.value)} className="w-[140px]" aria-label="დღე" />
          )}
          <div className="w-[200px]">
            <Dropdown<string>
              label="კატეგორია"
              value={[...cats][0] ?? ""}
              onChange={(v) => setCats(new Set(v ? [v] : []))}
              options={[{ value: "", label: "ყველა კატეგორია" }, ...catCounts.map(([k, n]) => ({ value: k, label: LOG_CATEGORY[k] ?? k, hint: `${n} ჩანაწერი` }))]}
            />
          </div>
          <div className="relative ml-auto min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ძებნა ჩანაწერებში" className="pl-8" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {LEVEL_CHIPS.map((l) => (
            <Chip key={l.key} active={levels.has(l.key)} onClick={() => setLevels(toggle(levels, l.key))}>
              {sevIcon(l.key === 4 ? null : l.key, "size-3")}
              {l.label}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          <Chip active={factsOnly} onClick={() => setFactsOnly(!factsOnly)}>მხოლოდ ფაქტი</Chip>
          <Chip active={problemsOnly} onClick={() => setProblemsOnly(!problemsOnly)}>{focus?.problem && problemsOnly ? focus.problem : "პრობლემები"}</Chip>
          <span className="tnum ml-auto text-[12px] text-ink-3">
            {rows.length}{source && rows.length !== source.length ? ` / ${source.length}` : ""}
            {period === "day" && dayQ.data && dayQ.data.total_events > dayQ.data.events.length && ` (სულ ${dayQ.data.total_events})`}
          </span>
          {anyFilter && (
            <button
              className="ml-2 text-[12px] font-medium text-accent hover:underline"
              onClick={() => {
                setCats(new Set());
                setLevels(new Set());
                setFactsOnly(false);
                setProblemsOnly(false);
                setQ("");
                onClearFocus();
              }}
            >
              გასუფთავება
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid h-40 place-items-center"><Spinner /></div>
        ) : rows.length === 0 ? (
          <Empty title="ფილტრს არაფერი ემთხვევა">შეცვალე პერიოდი, კატეგორია ან საძიებო ტექსტი.</Empty>
        ) : (
          <ul>
            {rows.slice(0, 500).map((e) => (
              <EventRow key={`${e.id}-${e.time_created}`} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
            ))}
            {rows.length > 500 && <li className="px-6 py-3 text-center text-[12.5px] text-ink-3">ნაჩვენებია პირველი 500. დააზუსტე ფილტრი.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function EventRow({ e, open, onToggle }: { e: LogEvent; open: boolean; onToggle: () => void }) {
  const src = e.sam_source ? SAM_SOURCE[e.sam_source] : null;
  const time = short(e.time_local ?? e.time_created.replace("T", " "));
  const subject = e.object_name ?? e.device_id ?? e.message ?? "";
  return (
    <li className={cn("border-b border-line", open && "bg-raised")}>
      <button onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[14px_14px_84px_minmax(0,150px)_44px_1fr] items-center gap-3 px-6 py-2 text-left text-[12.5px] hover:bg-ink/[0.025]">
        <ChevronRight className={cn("size-3.5 text-ink-3 transition-transform", open && "rotate-90")} />
        {sevIcon(e.severity ?? levelToSev(e.level))}
        <span className="tnum text-ink-2">{time}</span>
        <span className="truncate font-medium" title={e.provider ?? ""}>{e.category_label ?? LOG_CATEGORY[e.category ?? "other"]}</span>
        <span className="tnum text-ink-3">{e.event_id}</span>
        <span className="truncate text-ink-2">
          {e.occurrences > 1 && <span className="mr-1.5 font-medium text-ink">×{e.occurrences}</span>}
          {subject}
        </span>
      </button>
      {open && (
        <div className="anim-fade px-6 pb-3 pl-[66px]">
          <dl className="mb-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[12.5px]">
            <Dt>დრო</Dt><dd className="tnum">{e.time_local}</dd>
            <Dt>მომხმარებელი</Dt>
            <dd>
              {e.sam ?? "—"}
              {src && <span className={cn("ml-2 rounded-[4px] px-1.5 py-px text-[11.5px]", src.fact ? "bg-ok/15 text-ok" : "bg-high/15 text-high")} title={src.hint}>{src.label}</span>}
            </dd>
            <Dt>წყარო</Dt><dd className="break-all">{e.channel} / {e.provider} / {e.event_id}</dd>
            <Dt>დონე</Dt><dd>{LOG_LEVEL[e.level] ?? e.level}</dd>
            {e.problem_code && <><Dt>წესი</Dt><dd>{e.problem_code}</dd></>}
            {e.object_name && <><Dt>ობიექტი</Dt><dd data-selectable className="break-all">{e.object_name}</dd></>}
            {e.device_id && <><Dt>მოწყობილობა</Dt><dd data-selectable className="break-all">{e.device_id}</dd></>}
            {e.process_name && <><Dt>პროცესი</Dt><dd data-selectable className="break-all">{e.process_name}</dd></>}
            <Dt>კომპიუტერი</Dt><dd>{e.computer}</dd>
          </dl>
          <div className="flex items-start gap-2">
            <p data-selectable className="min-w-0 flex-1 rounded-ctl border border-line bg-sunken px-3 py-2 text-[12.5px] leading-relaxed break-words whitespace-pre-wrap">{e.message}</p>
            <IconButton label="ჩანაწერის კოპირება" onClick={() => copy(`${e.time_local}\t${e.sam ?? ""}\t${e.computer}\t${e.channel}/${e.event_id}\t${e.object_name ?? ""}\n${e.message ?? ""}`, "ჩანაწერი დაკოპირდა")}>
              <Copy className="size-3.5" />
            </IconButton>
          </div>
        </div>
      )}
    </li>
  );
}

const Dt = ({ children }: { children: ReactNode }) => <dt className="text-ink-3">{children}</dt>;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] whitespace-nowrap transition-colors",
        active ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- files & devices

function Activity({ snap }: { snap: LogSnapshot }) {
  const a = snap.activity;
  if (!a.deleted_files.length && !a.transferred_files.length && !a.devices.length)
    return <Empty title="ფაილური აქტივობა და მოწყობილობები არ დაფიქსირდა">ბოლო {snap.window_hours} საათში წაშლა, გადატანა ან მიერთება ლოგში არ ჩანს.</Empty>;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-[760px] space-y-6">
        {a.devices.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2"><Usb className="size-3.5 text-ink-3" />მიერთებული მოწყობილობები</h3>
            <ul className="divide-y divide-line rounded-[10px] border border-line bg-raised">
              {a.devices.map((d, i) => (
                <li key={i} className="flex items-start gap-3 px-3.5 py-2.5">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", d.flagged ? "bg-critical" : "bg-low")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px]", d.flagged && "font-medium")}>{d.kind_label}</p>
                    <p data-selectable className="truncate text-[12px] text-ink-3" title={d.device_id ?? ""}>{d.device_id}</p>
                  </div>
                  <span className="tnum shrink-0 text-[12px] text-ink-2">{short(d.time_local)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <FileList title="წაშლილი ფაილები" items={a.deleted_files} />
        <FileList title="გადატანილი ფაილები (USB / ქსელი)" items={a.transferred_files} />
      </div>
    </div>
  );
}

function FileList({ title, items }: { title: string; items: LogSnapshot["activity"]["deleted_files"] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
        <FileX2 className="size-3.5 text-ink-3" />
        {title}
        <span className="tnum font-normal text-ink-3">{items.length}</span>
        <button className="ml-auto font-normal text-accent hover:underline" onClick={() => copy(items.map((f) => `${f.time_local}\t${f.sam ?? ""}\t${f.object_name}`).join("\n"), "სია დაკოპირდა")}>
          სიის კოპირება
        </button>
      </h3>
      <ul className="max-h-[320px] divide-y divide-line overflow-y-auto rounded-[10px] border border-line bg-raised">
        {items.map((f, i) => (
          <li key={i} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 px-3.5 py-2 text-[12.5px]">
            <span className="tnum text-ink-2">{short(f.time_local)}</span>
            <span data-selectable className="truncate" title={f.object_name ?? ""}>{f.object_name}</span>
            <span className="text-ink-3">{f.sam}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- sessions

function Sessions({ sam }: { sam: string }) {
  const { data, isLoading } = useUserSessions(sam, 168, true);
  if (isLoading) return <div className="grid h-40 place-items-center"><Spinner /></div>;
  if (!data?.length) return <Empty title="სესიები ვერ მოიძებნა">ბოლო 7 დღეში ინტერაქტიული შესვლა არ დაფიქსირებულა.</Empty>;
  const LOGON: Record<number, string> = { 2: "კონსოლი", 7: "განბლოკვა", 10: "RDP", 11: "ქეშირებული" };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <ul className="mx-auto max-w-[640px] divide-y divide-line rounded-[10px] border border-line bg-raised">
        {data.map((s, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_90px_120px] items-center gap-3 px-3.5 py-2 text-[12.5px]">
            <span className="tnum">{short(s.start_local)}</span>
            <span className="tnum text-ink-2">{s.end_local ? s.end_local.slice(11, 16) : <span className="font-medium text-ok">ახლაც შესულია</span>}</span>
            <span className="text-ink-3">{s.logon_type ? (LOGON[s.logon_type] ?? s.logon_type) : "—"}</span>
            <span className="truncate text-ink-3">{s.computer}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
