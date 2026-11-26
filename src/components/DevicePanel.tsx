import { useState, type ReactNode } from "react";
import { AlertTriangle, CircleCheck, Cpu, HardDrive, MemoryStick, Printer as PrinterIcon, Star, Timer, XCircle } from "lucide-react";
import { dateTime } from "@/lib/format";
import { pct } from "@/lib/health";
import { DISK_HEALTH, MEDIA_LABEL, PRINTER_STATE } from "@/lib/labels";
import type { DeviceSnapshot, Issue, Printer } from "@/lib/types";
import { Meter } from "./ui/Meter";
import { Empty, Switch, cn } from "./ui/primitives";

export function DevicePanel({ snapshot }: { snapshot: DeviceSnapshot | null }) {
  const [showVirtual, setShowVirtual] = useState(false);
  if (!snapshot)
    return (
      <Empty title="კომპიუტერის მონაცემები არ არის">
        მოთხოვნა შეიქმნა აპის გარეშე ან ძველი ვერსიით, ამიტომ მდგომარეობა არ შემოწმებულა.
      </Empty>
    );

  const s = snapshot;
  const ram = pct(s.memory.used_gb, s.memory.total_gb);
  const printers = s.printers.filter((p) => showVirtual || !p.virtual);
  const hiddenVirtual = s.printers.filter((p) => p.virtual).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-[720px] space-y-6">
        <IssueList issues={s.issues} capturedAt={s.captured_at} />

        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          <Block icon={<Cpu />} title="პროცესორი">
            <p className="truncate text-[13px]" title={s.cpu.name}>{s.cpu.name || "—"}</p>
            <p className="mt-0.5 text-[12px] text-ink-3">{s.cpu.cores} ბირთვი, {s.cpu.threads} ნაკადი</p>
            <Usage label="დატვირთვა" value={s.cpu.load_percent} text={`${s.cpu.load_percent}%`} />
          </Block>

          <Block icon={<MemoryStick />} title="ოპერატიული მეხსიერება">
            <p className="tnum text-[13px]">{s.memory.total_gb.toFixed(1)} GB</p>
            <p className="mt-0.5 text-[12px] text-ink-3">თავისუფალი {(s.memory.total_gb - s.memory.used_gb).toFixed(1)} GB</p>
            <Usage label="გამოყენებული" value={ram} text={`${ram}%`} />
          </Block>
        </div>

        <Block icon={<HardDrive />} title="დისკები">
          <ul className="divide-y divide-line rounded-[10px] border border-line bg-raised">
            {s.disks.map((d, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cn("w-[74px] shrink-0 rounded-[5px] py-0.5 text-center text-[11.5px] font-semibold", d.media === "HDD" ? "bg-high/15 text-high" : "bg-accent-soft text-accent")}>
                  {MEDIA_LABEL[d.media]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]" title={d.model}>{d.model}</span>
                  <span className="tnum block text-[12px] text-ink-3">
                    {d.size_gb >= 1000 ? `${(d.size_gb / 1024).toFixed(1)} TB` : `${Math.round(d.size_gb)} GB`}, {d.bus}
                    {d.wear_percent != null && `, ცვეთა ${d.wear_percent}%`}
                    {d.temperature_c != null && `, ${d.temperature_c}°C`}
                  </span>
                </span>
                <HealthTag health={d.health} />
              </li>
            ))}
            {s.disks.length === 0 && <li className="px-3 py-2.5 text-[13px] text-ink-3">ფიზიკური დისკები ვერ წაიკითხა</li>}
          </ul>

          <ul className="mt-3 space-y-2.5">
            {s.volumes.map((v) => {
              const used = 100 - pct(v.free_gb, v.total_gb);
              return (
                <li key={v.letter} className="grid grid-cols-[52px_1fr_150px] items-center gap-3 text-[12.5px]">
                  <span className="font-medium">{v.letter}{v.label && <span className="ml-1 font-normal text-ink-3">{v.label}</span>}</span>
                  <Meter value={used} label={`${v.letter} გამოყენებული`} />
                  <span className="tnum text-right text-ink-2">{v.free_gb.toFixed(1)} / {v.total_gb.toFixed(0)} GB თავისუფ.</span>
                </li>
              );
            })}
          </ul>
        </Block>

        <Block
          icon={<PrinterIcon />}
          title="პრინტერები"
          aside={
            hiddenVirtual > 0 && (
              <label className="flex items-center gap-2 text-[12px] text-ink-3">
                ვირტუალურიც
                <Switch checked={showVirtual} onChange={setShowVirtual} label="ვირტუალური პრინტერების ჩვენება" />
              </label>
            )
          }
        >
          {printers.length === 0 ? (
            <p className="text-[13px] text-ink-3">პრინტერი არ არის დაყენებული</p>
          ) : (
            <ul className="divide-y divide-line rounded-[10px] border border-line bg-raised">
              {printers.map((p) => (
                <PrinterRow key={p.name} p={p} />
              ))}
            </ul>
          )}
        </Block>

        <Block icon={<Timer />} title="ჩართულია">
          <p className="tnum text-[13px]">
            {s.uptime_hours >= 48 ? `${Math.floor(s.uptime_hours / 24)} დღე` : `${Math.round(s.uptime_hours)} საათი`}
            <span className="ml-2 text-ink-3">ბოლო გადატვირთვიდან</span>
          </p>
        </Block>
      </div>
    </div>
  );
}

export function IssueList({ issues, capturedAt, compact }: { issues: Issue[]; capturedAt?: string; compact?: boolean }) {
  if (!issues.length)
    return (
      <div className="flex items-center gap-2 rounded-[10px] border border-line bg-raised px-3.5 py-2.5 text-[13px]">
        <CircleCheck className="size-4 text-ok" />
        კომპიუტერზე პრობლემა არ გამოვლინდა
        {capturedAt && <span className="ml-auto text-[12px] text-ink-3">შემოწმდა {dateTime(capturedAt)}</span>}
      </div>
    );
  return (
    <div className="rounded-[10px] border border-line bg-raised">
      {!compact && (
        <div className="flex items-baseline justify-between border-b border-line px-3.5 py-2">
          <span className="text-[13px] font-medium">რას მიაქციო ყურადღება</span>
          {capturedAt && <span className="text-[12px] text-ink-3">შემოწმდა {dateTime(capturedAt)}, მოთხოვნის გახსნისას</span>}
        </div>
      )}
      <ul className="px-3.5 py-1.5">
        {issues.map((i, k) => (
          <li key={k} className="flex items-start gap-2.5 py-1.5 text-[13px]">
            {i.level === "error" ? <XCircle className="mt-0.5 size-3.5 shrink-0 text-critical" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-high" />}
            {i.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrinterRow({ p }: { p: Printer }) {
  const ok = p.state === "ready" || p.state === "printing";
  const bad = p.reachable === false || (!ok && p.state !== "unknown");
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className={cn("size-2 shrink-0 rounded-full", bad ? "bg-critical" : p.state === "unknown" ? "bg-low" : "bg-ok")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px]">
          <span className="truncate" title={p.name}>{p.name}</span>
          {p.is_default && <Star className="size-3 shrink-0 fill-current text-high" aria-label="ნაგულისხმევი" />}
        </span>
        <span className="block truncate text-[12px] text-ink-3">
          {p.is_network ? "ქსელური" : "ლოკალური"}
          {p.port && `, ${p.port}`}
          {p.reachable === true && ", პინგს პასუხობს"}
        </span>
      </span>
      {p.jobs > 0 && <span className="tnum shrink-0 text-[12px] text-ink-2">რიგში {p.jobs}</span>}
      <span className={cn("shrink-0 text-[12.5px]", bad ? "font-medium text-critical" : "text-ink-2")}>
        {p.reachable === false ? "არ პასუხობს" : PRINTER_STATE[p.state]}
      </span>
    </li>
  );
}

function HealthTag({ health }: { health: DeviceSnapshot["disks"][number]["health"] }) {
  const color = health === "Healthy" ? "text-ok" : health === "Warning" ? "text-high" : health === "Unhealthy" ? "text-critical" : "text-ink-3";
  return <span className={cn("shrink-0 text-[12.5px]", color, health !== "Healthy" && "font-medium")}>{DISK_HEALTH[health]}</span>;
}

function Usage({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div className="mt-2.5">
      <div className="mb-1 flex justify-between text-[12px]">
        <span className="text-ink-2">{label}</span>
        <span className="tnum">{text}</span>
      </div>
      <Meter value={value} label={label} />
    </div>
  );
}

function Block({ icon, title, aside, children }: { icon: ReactNode; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 [&>svg]:size-3.5 [&>svg]:text-ink-3">
        {icon}
        {title}
        <span className="ml-auto">{aside}</span>
      </h3>
      {children}
    </section>
  );
}
