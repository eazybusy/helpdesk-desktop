import { useState, type ReactNode } from "react";
import { shortDate } from "@/lib/format";
import type { Stats } from "@/lib/types";
import { cn } from "./ui/primitives";

// Building blocks shared by the dashboard and the report.

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-10 pt-9 pb-10 max-[900px]:px-5">{children}</div>
    </div>
  );
}


export function Figures({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("mt-7 grid auto-cols-fr grid-flow-col gap-3", className)}>{children}</dl>;
}

/** A number card, drawn like the employee app's request counters: icon tile, value, label. */
export function Figure({ icon, label, value, alert, tone, onClick }: { icon: ReactNode; label: string; value: number | string; alert?: boolean; tone?: "accent"; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  const hot = !alert && tone === "accent" && Number(value) > 0;
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-panel border border-line bg-raised px-4 py-3.5 text-left shadow-card transition-[border-color,box-shadow] duration-150",
        hot && "border-accent/40",
        onClick && "hover:border-line-strong hover:shadow-tab",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-tile [&>svg]:size-[19px] [&>svg]:stroke-[1.7]",
          alert ? "status-pill status-new !shadow-none" : "bg-accent-soft text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <dd className={cn("block text-[22px] leading-none font-medium whitespace-nowrap", typeof value === "number" ? "mono" : "tnum", alert && "text-critical", hot && "text-accent")}>{value}</dd>
        <dt className="mt-1 block truncate text-[12.5px] text-ink-2" title={label}>
          {label}
        </dt>
      </span>
    </Tag>
  );
}

export function Panel({ title, aside, className, children }: { title: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-panel border border-line bg-raised px-5 pt-4 pb-4 shadow-card", className)}>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold tracking-[-0.005em]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}


export function Legend() {
  return (
    <div className="flex gap-3 text-[12px] text-ink-2">
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-chart-1" />შემოსული</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-chart-2" />დასრულებული</span>
    </div>
  );
}

/** Opened vs resolved per day (or per week). Two series → legend (Legend) + hover tooltip. */
export function TrendChart({ data, unit = "day", height = 150 }: { data: Stats["daily"]; unit?: "day" | "week"; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.resolved]));
  const step = Math.ceil(max / 3);
  const top = step * 3;
  const H = height;
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="relative">
      <div className="flex">
        <div className="tnum relative w-6 shrink-0 text-[11px] text-ink-3" style={{ height: H }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="absolute right-1.5 -translate-y-1/2" style={{ top: H - (i * step * H) / top }}>
              {i * step}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {[1, 2, 3].map((i) => (
            <span key={i} className="absolute inset-x-0 border-t border-line/70" style={{ top: H - (i * step * H) / top }} />
          ))}
          <span className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
          <div className="absolute inset-0 flex">
            {data.map((d, i) => (
              <div
                key={d.date}
                className={cn("relative flex flex-1 items-end justify-center gap-[2px]", hover === i && "bg-ink/[0.035]")}
                onMouseEnter={() => setHover(i)}
              >
                <span className="w-[min(9px,32%)] rounded-t-[3px] bg-chart-1" style={{ height: (d.created / top) * H }} />
                <span className="w-[min(9px,32%)] rounded-t-[3px] bg-chart-2" style={{ height: (d.resolved / top) * H }} />
              </div>
            ))}
          </div>
          {hover != null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 w-36 -translate-x-1/2 -translate-y-full rounded-ctl border border-line bg-raised px-2.5 py-2 text-[12px] shadow-pop"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              <p className="font-medium">{unit === "week" ? `${shortDate(data[hover].date)}-ის კვირა` : shortDate(data[hover].date)}</p>
              <p className="mt-1 flex justify-between text-ink-2"><span>შემოსული</span><span className="tnum text-ink">{data[hover].created}</span></p>
              <p className="flex justify-between text-ink-2"><span>დასრულებული</span><span className="tnum text-ink">{data[hover].resolved}</span></p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex pl-6 text-[11px] text-ink-3">
        {data.map((d, i) => (
          <span key={d.date} className="flex-1 text-center whitespace-nowrap">{i % labelEvery === labelEvery - 1 || i === data.length - 1 ? shortDate(d.date) : ""}</span>
        ))}
      </div>
    </div>
  );
}


interface RankItem {
  key: string;
  label: string;
  /** Muted second line, e.g. the category. */
  sub?: string;
  value: number;
  /** Shown after the count, e.g. an average time. */
  note?: string;
}

/**
 * Ranked horizontal bars, one hue (single series → no legend; the panel title names it).
 * Count at the tip in text ink; share of the total on hover.
 */
export function RankBars({ items, total, empty = "მონაცემი არ არის.", onPick }: { items: RankItem[]; total: number; empty?: string; onPick?: (key: string) => void }) {
  if (!items.length) return <p className="py-6 text-center text-[13px] text-ink-3">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  const Tag = onPick ? "button" : "div";
  return (
    <ol className="-mx-2 space-y-0.5">
      {items.map((it, i) => (
        <li key={it.key}>
          <Tag
            onClick={onPick ? () => onPick(it.key) : undefined}
            className={cn("group block w-full rounded-[9px] px-2 py-1.5 text-left", onPick && "transition-colors hover:bg-hover")}
            title={`${it.label}: ${it.value} (${total ? Math.round((it.value / total) * 100) : 0}%)`}
          >
            <span className="flex items-baseline gap-2">
              <span className="tnum w-4 shrink-0 text-right text-[11.5px] text-ink-3">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {it.label}
                {it.sub && <span className="ml-1.5 text-[12px] text-ink-3">{it.sub}</span>}
              </span>
              <span className="tnum shrink-0 text-[13px] font-medium">{it.value}</span>
              <span className="tnum w-9 shrink-0 text-right text-[11.5px] text-ink-3">
                <span className="group-hover:hidden">{it.note ?? ""}</span>
                <span className="hidden group-hover:inline">{total ? Math.round((it.value / total) * 100) : 0}%</span>
              </span>
            </span>
            <span className="mt-1 ml-6 block h-1.5 overflow-hidden rounded-full bg-sunken">
              <span className="block h-full rounded-r-[4px] bg-chart-1 transition-[width] duration-500" style={{ width: `${(it.value / max) * 100}%` }} />
            </span>
          </Tag>
        </li>
      ))}
    </ol>
  );
}

/** One whole in two parts (head office / regions): segmented bar + legend with counts and shares. */
export function SplitBar({ parts }: { parts: { label: string; value: number; tone: "chart-1" | "chart-2" }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px] bg-sunken">
        {parts.map((p) =>
          p.value > 0 ? (
            <span
              key={p.label}
              title={`${p.label}: ${p.value} (${pct(p.value)}%)`}
              className={cn("h-full transition-[flex-grow] duration-500", p.tone === "chart-1" ? "bg-chart-1" : "bg-chart-2")}
              style={{ flexGrow: p.value }}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        {parts.map((p) => (
          <div key={p.label}>
            <dt className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              <span className={cn("size-2 rounded-[2px]", p.tone === "chart-1" ? "bg-chart-1" : "bg-chart-2")} />
              {p.label}
            </dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span className="display tnum text-[22px] leading-none">{p.value}</span>
              <span className="tnum text-[12.5px] text-ink-3">{pct(p.value)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
