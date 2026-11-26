import { useState } from "react";
import { Copy, Eye, EyeOff, Loader2, MonitorUp } from "lucide-react";
import { toast } from "sonner";
import { relative, rustdeskLabel } from "@/lib/format";
import type { RemoteAccess as RA } from "@/lib/types";
import { IconButton, cn } from "./ui/primitives";

const copy = (what: string, value: string) =>
  navigator.clipboard.writeText(value).then(() => toast.success(`${what} დაკოპირდა`), () => toast.error("კოპირება ვერ მოხერხდა"));

/**
 * RustDesk ID and the one-time password the employee's PC set when the ticket was opened.
 * Only staff ever receive this block from the server.
 */
export function RemoteAccess({ remote, createdAt, inline }: { remote: RA; createdAt: string; inline?: boolean }) {
  const [show, setShow] = useState(false);
  const id = remote.rustdesk_id;
  if (!id) return null;
  const pw = remote.password;
  const late = !pw && Date.now() - Date.parse(createdAt) > 3 * 60_000;
  const link = `rustdesk://connection/new/${encodeURIComponent(id)}${pw ? `?password=${encodeURIComponent(pw)}` : ""}`;

  return (
    <div className={cn("border-t border-line pt-4", inline ? "mt-4" : "mt-6")}>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
        <MonitorUp className="size-3.5" />
        დისტანციური წვდომა
      </h3>
      <div className="rounded-[10px] border border-line bg-sunken/60 p-3">
        <dl className="space-y-2">
          <div className="group">
            <dt className="text-[12px] text-ink-3">RustDesk ID</dt>
            <dd className="flex items-center gap-1">
              <span data-selectable className="tnum min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[0.02em]">{rustdeskLabel(id)}</span>
              <IconButton label="ID: კოპირება" className="size-6" onClick={() => copy("ID", id)}>
                <Copy className="size-3" />
              </IconButton>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-3">ერთჯერადი პაროლი</dt>
            <dd className="flex min-h-6 items-center gap-1">
              {pw ? (
                <>
                  <span data-selectable className="tnum min-w-0 flex-1 truncate font-mono text-[13.5px]">{show ? pw : "•".repeat(Math.min(pw.length, 10))}</span>
                  <IconButton label={show ? "პაროლის დამალვა" : "პაროლის ჩვენება"} className="size-6" onClick={() => setShow((v) => !v)}>
                    {show ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  </IconButton>
                  <IconButton label="პაროლი: კოპირება" className="size-6" onClick={() => copy("პაროლი", pw)}>
                    <Copy className="size-3" />
                  </IconButton>
                </>
              ) : late ? (
                <span className="text-[12.5px] leading-snug text-ink-3">კომპიუტერიდან პაროლი არ მოვიდა. RustDesk-ის ფანჯრიდან ჰკითხე თანამშრომელს.</span>
              ) : (
                <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                  <Loader2 className="size-3 animate-spin" />
                  მზადდება
                </span>
              )}
            </dd>
          </div>
        </dl>
        <a
          href={link}
          className="mt-3 flex h-8 items-center justify-center gap-1.5 rounded-ctl bg-accent text-[12.5px] font-medium text-accent-ink shadow-btn transition-colors hover:bg-accent-hover"
        >
          <MonitorUp className="size-3.5" />
          RustDesk-ით დაკავშირება
        </a>
        {remote.updated_at && <p className="mt-2 text-center text-[11.5px] text-ink-3">პაროლი დაყენდა {relative(remote.updated_at)}</p>}
      </div>
    </div>
  );
}
