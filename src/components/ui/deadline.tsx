import { useId } from "react";
import { hm, shortDate } from "@/lib/format";
import { cn } from "./primitives";

// Deadlines (SLA) drawn as a drop of water: full when the ticket is fresh, draining as its time runs
// out, empty and red once it is past due. One mark for the queues, the ticket
// and the dashboard. Employees never see it. Colour comes from a class (currentColor in the SVG), not
// from var() inside SVG attributes, which older WebView2 runtimes don't render.

type DeadlineTone = "ok" | "soon" | "late";

const TONE_CLASS: Record<DeadlineTone, string> = { ok: "text-accent", soon: "text-high", late: "text-critical" };

/** Where a deadline stands: time left (negative = past due), share of the window left, and its tone. */
function deadline(created: string, due: string, now = Date.now()) {
  const start = Date.parse(created);
  const end = Date.parse(due);
  const left = end - now;
  const share = Math.max(0, Math.min(1, left / Math.max(1, end - start)));
  const tone: DeadlineTone = left < 0 ? "late" : share < 0.25 ? "soon" : "ok";
  return { left, share, tone };
}

/** "21 სთ", "45 წთ", "3 დღე": the short form for lists. */
function shortSpan(ms: number) {
  const m = Math.max(1, Math.round(Math.abs(ms) / 60000));
  if (m < 60) return `${m} წთ`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} სთ` : `${Math.round(h / 24)} დღე`;
}

/** "დღეს, 18:00", "ხვალ, 10:30", "20 ნოე, 10:30". */
function dueLabel(due: string, now = Date.now()) {
  const d = new Date(due);
  const day = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const diff = Math.round((day(d.getTime()) - day(now)) / 86_400_000);
  const when = diff === 0 ? "დღეს" : diff === 1 ? "ხვალ" : diff === -1 ? "გუშინ" : shortDate(due);
  return `${when}, ${hm(due)}`;
}

const DROP = "M8 1.6C8 1.6 3.4 6.6 3.4 10.1a4.6 4.6 0 0 0 9.2 0C12.6 6.6 8 1.6 8 1.6Z";
const TOP = 1.6;
const HEIGHT = 13.1;

/** The small drop: `level` 0..1 is how much water (time) is left. */
function Drop({ level, tone, className, title }: { level: number; tone: DeadlineTone; className?: string; title?: string }) {
  const clip = `dr${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const y = TOP + (1 - Math.max(0, Math.min(1, level))) * HEIGHT;
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5 shrink-0", TONE_CLASS[tone], className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <clipPath id={clip}>
          <path d={DROP} />
        </clipPath>
      </defs>
      <path d={DROP} fill="currentColor" fillOpacity="0.1" />
      {level > 0 && <rect x="0" y={y} width="16" height={16 - y} fill="currentColor" clipPath={`url(#${clip})`} />}
      <path d={DROP} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A ticket's deadline in words, with the drop in front.
 *  compact — lists: "21 სთ", past due "+2 სთ"
 *  text    — rows on the dashboard: "დარჩა 21 სთ" / "გადაცილდა 2 სთ-ით"
 *  detail  — the ticket's side panel: the text plus when it is due
 */
export function Deadline({ created, due, variant = "text", className }: { created: string; due: string | null; variant?: "compact" | "text" | "detail"; className?: string }) {
  if (!due) return null;
  const d = deadline(created, due);
  const late = d.tone === "late";
  const words = late ? `ვადა გადაცილდა ${shortSpan(d.left)}-ით` : `დარჩა ${shortSpan(d.left)}`;
  const color = d.tone === "ok" ? "text-ink-2" : TONE_CLASS[d.tone];

  if (variant === "detail")
    return (
      <span className={cn("flex items-start gap-2", className)}>
        <Drop level={d.share} tone={d.tone} className="mt-[1px] size-4" />
        <span className="min-w-0 leading-tight">
          <span className={cn("tnum block text-[13px] font-medium", late ? "text-critical" : d.tone === "soon" ? "text-high" : "text-ink")}>{words}</span>
          <span className="tnum mt-0.5 block text-[12px] text-ink-3">{late ? `ვადა იყო ${dueLabel(due)}` : `ვადა: ${dueLabel(due)}`}</span>
        </span>
      </span>
    );

  return (
    <span className={cn("tnum inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap", variant === "compact" ? "text-[12px]" : "text-[12.5px]", color, className)} title={`${words} · ვადა ${dueLabel(due)}`}>
      <Drop level={d.share} tone={d.tone} className={variant === "compact" ? "size-3" : "size-3.5"} />
      {variant === "compact" ? (late ? `+${shortSpan(d.left)}` : shortSpan(d.left)) : words}
    </span>
  );
}
