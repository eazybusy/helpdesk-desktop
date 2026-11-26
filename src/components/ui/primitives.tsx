import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export const cn = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-btn hover:bg-accent-hover disabled:opacity-50 disabled:shadow-none",
  secondary: "bg-raised text-ink border border-line shadow-xs hover:border-line-strong hover:bg-sunken/60 disabled:opacity-50",
  ghost: "text-ink-2 hover:text-ink hover:bg-ink/[0.05] disabled:opacity-40",
  danger: "text-critical hover:bg-critical/10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-ctl font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:active:scale-100",
        size === "md" ? "h-9 px-3.5 text-[13px]" : "h-7 px-2.5 text-[12.5px]",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn("grid size-7 place-items-center rounded-ctl text-ink-3 transition-colors hover:bg-ink/[0.06] hover:text-ink", className)}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

const field =
  "w-full rounded-ctl border border-line bg-raised px-3 text-ink shadow-xs placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-critical aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgb(200_51_28/0.15)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(field, "h-9", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(field, "resize-none py-2.5 leading-relaxed", className)} {...rest} />;
});

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-line bg-raised px-1 font-sans text-[10.5px] font-medium text-ink-3 shadow-[0_1px_0_var(--line)]">
      {children}
    </kbd>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin text-ink-3", className)} />;
}

/** Placeholder bar shown while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block h-3", className)} />;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-10 text-center anim-fade">
      {icon && <div className="mb-1.5 grid size-11 place-items-center rounded-full bg-sunken text-ink-3 [&>svg]:size-5">{icon}</div>}
      <p className="display text-[15px] text-ink">{title}</p>
      {children && <div className="max-w-xs text-[13px] leading-relaxed text-ink-2">{children}</div>}
    </div>
  );
}

/** Pill tabs: a sunken track with the active option raised on a soft shadow. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex gap-0.5 rounded-[10px] bg-sunken p-[3px] shadow-[inset_0_1px_2px_rgb(13_27_42/0.06)]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-[28px] items-center justify-center gap-1.5 rounded-[7px] px-3 text-[12.5px] whitespace-nowrap transition-[background-color,box-shadow,color] duration-150 [&_svg]:size-3.5",
            value === o.value ? "bg-raised font-medium text-ink shadow-tab" : "text-ink-2 hover:bg-raised/50 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)] transition-colors duration-200",
        checked ? "bg-accent" : "bg-line-strong",
      )}
    >
      <span className={cn("absolute top-[2px] left-[2px] size-4 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200", checked && "translate-x-4")} />
    </button>
  );
}

/** Small count shown inside tabs and nav items. */
export function Count({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "accent" }) {
  return (
    <span
      className={cn(
        "tnum inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] font-semibold",
        tone === "warn" && "bg-high/15 text-high",
        tone === "accent" && "bg-accent text-accent-ink",
        tone === "neutral" && "bg-ink/[0.07] text-ink-2",
      )}
    >
      {children}
    </span>
  );
}
