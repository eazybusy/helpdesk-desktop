import { BRAND } from "@/lib/brand";
import markSvg from "@/assets/logo-mark.svg?raw";
import { cn } from "./primitives";

/** Inline so the two brand colours can follow the theme (see --logo-* in index.css). */
function LogoMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block select-none [&>svg]:h-full [&>svg]:w-auto", className)} dangerouslySetInnerHTML={{ __html: markSvg }} />;
}

/** Company lockup as on the official logo: mark + two Georgian lines + English line. */
export function Lockup({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className={cn("flex items-center", lg ? "gap-3.5" : "gap-2.5", className)} aria-label={BRAND.nameKa}>
      <LogoMark className={lg ? "h-14 w-auto" : "h-[38px] w-auto"} />
      <div className="leading-none whitespace-nowrap" aria-hidden>
        <p className={cn("font-bold text-[var(--logo-text)]", lg ? "text-[14.5px] leading-[1.18]" : "text-[11.5px] leading-[1.18]")} style={{ fontStretch: "100%" }}>
          {BRAND.nameKaLines[0]}
          <br />
          {BRAND.nameKaLines[1]}
        </p>
        <p className={cn("mt-[3px] font-bold tracking-[0.01em] text-[var(--logo-text-en)]", lg ? "text-[11px]" : "text-[8.6px]")}>{BRAND.nameEn}</p>
      </div>
    </div>
  );
}
