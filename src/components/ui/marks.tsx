import { useId } from "react";
import { STATUS } from "@/lib/labels";
import { initials } from "@/lib/format";
import type { TicketStatus, User } from "@/lib/types";
import { cn } from "./primitives";

/**
 * Colour per status comes from plain CSS classes (index.css, `.status-*`): no color-mix() and
 * no var() inside SVG attributes, both of which older WebView2 runtimes don't render.
 */
const STATUS_CLASS: Record<TicketStatus, string> = {
  new: "status-new",
  open: "status-open",
  closed: "status-closed",
};

/**
 * Status as a vessel that fills up: empty when new, half while being worked,
 * full with a tick when closed. Drawn in currentColor.
 */
export function StatusGlyph({ status, className }: { status: TicketStatus; className?: string }) {
  // useId() contains characters that aren't safe inside url(#…)
  const clip = `sg${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 14 14" className={cn("status-fg size-3.5 shrink-0", STATUS_CLASS[status], className)} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <circle cx="7" cy="7" r="5.25" />
        </clipPath>
      </defs>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {status === "open" && <rect x="0" y="7.4" width="14" height="7" fill="currentColor" clipPath={`url(#${clip})`} />}
      {status === "closed" && (
        <>
          <circle cx="7" cy="7" r="5.5" fill="currentColor" />
          <path d="M4.4 7.2l1.8 1.8 3.5-3.7" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/** Soft tinted pill: glyph + label in the status colour. */
export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span
      className={cn(
        "status-pill inline-flex h-[22px] items-center gap-1.5 rounded-full pr-2.5 pl-1.5 text-[12px] font-medium whitespace-nowrap",
        STATUS_CLASS[status],
        className,
      )}
    >
      <StatusGlyph status={status} className="size-3" />
      {STATUS[status]}
    </span>
  );
}

export function StatusLabel({ status, className }: { status: TicketStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}

export function Avatar({ user, size = 24, className }: { user: Pick<User, "full_name" | "id">; size?: number; className?: string }) {
  const hues = [190, 160, 210, 28, 260, 340, 120];
  const h = hues[user.id % hues.length];
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(140deg, oklch(0.93 0.045 ${h}), oklch(0.85 0.07 ${h}))`,
        color: `oklch(0.34 0.08 ${h})`,
        boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.06)",
      }}
      aria-hidden
    >
      {initials(user.full_name)}
    </span>
  );
}
