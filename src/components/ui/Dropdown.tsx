import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./primitives";

interface Option<T> {
  value: T;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

interface Props<T> {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  label: string;
  /** "field" = full-width form control, "inline" = compact property row */
  appearance?: "field" | "inline";
  disabled?: boolean;
  align?: "left" | "right";
}

/** Small accessible listbox. Native <select> can't show icons and looks foreign in a custom-drawn window. */
export function Dropdown<T extends string | number | null>({
  value,
  options,
  onChange,
  label,
  appearance = "field",
  disabled,
  align = "left",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  // Only on open/close: `options` is a new array on every parent render (e.g. after a poll),
  // and re-running here would reset the keyboard highlight and steal focus.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    requestAnimationFrame(() => list.current?.focus());
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = () => {
    if (!open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(!open);
  };

  const choose = (i: number) => {
    const option = options[i]; // the list can shrink while open
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={root} className={cn("relative", appearance === "field" && "w-full")}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
        className={cn(
          "flex items-center gap-2 rounded-ctl text-left transition-[border-color,box-shadow,background-color] duration-150 disabled:opacity-60",
          appearance === "field"
            ? "h-9 w-full border border-line bg-raised px-3 shadow-xs hover:border-line-strong"
            : "-ml-2 h-7 max-w-[calc(100%+0.5rem)] px-2 hover:bg-ink/[0.05]",
          open && appearance === "field" && "border-accent shadow-[0_0_0_3px_var(--ring)]",
        )}
      >
        {current?.icon}
        <span className="min-w-0 flex-1 truncate text-[13px]">{current?.label ?? "—"}</span>
        <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
      </button>

      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={onKey}
          className={cn(
            "anim-pop absolute z-50 mt-1.5 max-h-72 min-w-full overflow-auto rounded-[12px] bg-raised p-1.5 shadow-pop focus:outline-none",
            align === "right" ? "right-0" : "left-0",
            appearance === "inline" && "w-56",
          )}
        >
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={cn("flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[13px] transition-colors", i === active && "bg-ink/[0.055]")}
            >
              {o.icon}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.hint && <span className="block truncate text-[12px] text-ink-3">{o.hint}</span>}
              </span>
              {o.value === value && <Check className="size-3.5 text-accent" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
