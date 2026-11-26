import { useQueryClient } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { DEMO_ALLOWED, TARGET } from "@/lib/target";
import { useSession, type PreviewAs } from "@/store/session";
import { cn } from "./ui/primitives";

/** Bottom bar: version, demo tag, copyright. Quiet, one line, aligned with the sidebar icons. */
export function Footer() {
  const mock = useSession((s) => s.useMock);
  return (
    <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-line bg-bg pr-6 pl-7 text-[12px] text-ink-3 max-[760px]:px-4">
      <Clock3 className="size-[13px] shrink-0" strokeWidth={1.7} />
      <span className="mono truncate">{BRAND.system} v{BRAND.version}</span>
      {DEMO_ALLOWED && mock && TARGET !== "preview" && <span className="rounded-full bg-sunken px-2.5 py-px text-[11px]">სადემონსტრაციო რეჟიმი</span>}
      {TARGET === "preview" && <PreviewSwitch />}
      <span className="ml-auto truncate max-[900px]:hidden">{BRAND.copyright}</span>
    </footer>
  );
}

const PREVIEW: { value: PreviewAs; label: string }[] = [
  { value: "employee", label: "აპი: თანამშრომელი" },
  { value: "staff", label: "ვები: ადმინი, IT" },
];

/** Preview build only: flip between the employee desktop app and the staff web app (shared demo data).
 * There is one employee app for head office and regions alike; the server tells them apart by computer name. */
function PreviewSwitch() {
  const { previewAs, set, logout } = useSession();
  const qc = useQueryClient();
  return (
    <div role="radiogroup" aria-label="დემო" className="flex gap-0.5 rounded-full bg-sunken p-0.5">
      {PREVIEW.map((p) => (
        <button
          key={p.value}
          role="radio"
          aria-checked={previewAs === p.value}
          onClick={() => {
            if (p.value === previewAs) return;
            logout();
            qc.clear();
            set({ previewAs: p.value });
          }}
          className={cn(
            "h-[22px] rounded-full px-2.5 text-[11px] whitespace-nowrap transition-[background-color,box-shadow]",
            previewAs === p.value ? "bg-raised font-medium text-ink shadow-tab" : "text-ink-3 hover:text-ink",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
