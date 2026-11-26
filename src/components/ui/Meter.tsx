import { cn } from "./primitives";

/** Thin usage bar. `warn`/`bad` are thresholds in percent of the bar. */
export function Meter({ value, warn = 80, bad = 90, className, label }: { value: number; warn?: number; bad?: number; className?: string; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= bad ? "var(--critical)" : v >= warn ? "var(--high)" : "var(--accent)";
  return (
    <span role="meter" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} className={cn("relative block h-[5px] overflow-hidden rounded-full bg-line", className)}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, background: color }} />
    </span>
  );
}
