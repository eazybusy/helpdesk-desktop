import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import type { User } from "@/lib/types";
import { useNav } from "@/store/nav";
import { useSession, type Theme } from "@/store/session";
import { Avatar } from "./ui/marks";
import { cn } from "./ui/primitives";

const ROLE_LABEL = { admin: "მთავარი ადმინი", agent: "IT სპეციალისტი", user: "" } as const;

/** Profile button in the header: the same actions as before (settings, theme, sign out), one click closer. */
/** canSignOut: web only — the desktop app is always signed in as the Windows user. */
export function UserMenu({ user, canSignOut }: { user: User; canSignOut: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { theme, set, logout } = useSession();
  const go = useNav((s) => s.go);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const themes: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun />, label: "ღია" },
    { value: "dark", icon: <Moon />, label: "მუქი" },
    { value: "system", icon: <Monitor />, label: "სისტემური" },
  ];

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn("flex h-9 items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition-colors hover:bg-ink/[0.05]", open && "bg-ink/[0.05]")}
      >
        <Avatar user={user} size={28} />
        <span className="max-w-[160px] truncate text-[13px] font-medium">{user.full_name}</span>
        <ChevronDown className={cn("size-3.5 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div role="menu" className="anim-pop absolute top-full right-0 z-50 mt-2 w-[300px] rounded-[12px] bg-raised p-1.5 shadow-pop">
          <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2.5">
            <Avatar user={user} size={34} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-semibold">{user.full_name}</p>
              <p className="truncate text-[12px] text-ink-3">{ROLE_LABEL[user.role] || user.department || user.username}</p>
            </div>
          </div>
          <div className="mx-1 mb-1.5 grid grid-cols-3 gap-0.5 rounded-[9px] bg-sunken p-[3px]">
            {themes.map((t) => (
              <button
                key={t.value}
                role="menuitemradio"
                aria-checked={theme === t.value}
                title={t.label}
                onClick={() => set({ theme: t.value })}
                className={cn(
                  "flex h-7 items-center justify-center gap-1 rounded-[7px] text-[12px] transition-[background-color,box-shadow] [&>svg]:size-3.5",
                  theme === t.value ? "bg-raised font-medium shadow-tab" : "text-ink-2 hover:text-ink",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <MenuItem icon={<Settings />} onClick={() => { go("settings"); setOpen(false); }}>პარამეტრები</MenuItem>
          {canSignOut && (
            <>
              <div className="my-1 h-px bg-line" />
              <MenuItem icon={<LogOut />} danger onClick={() => { logout(); qc.clear(); }}>გასვლა</MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-[7px] px-2.5 text-[13px] transition-colors [&>svg]:size-4",
        danger ? "text-critical hover:bg-critical/10" : "text-ink hover:bg-ink/[0.05] [&>svg]:text-ink-3",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
