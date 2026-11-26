import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { windowControls } from "@/lib/tauri";
import { useNav } from "@/store/nav";
import type { AppKind } from "@/lib/target";
import { useSession } from "@/store/session";
import { UserMenu } from "./UserMenu";
import { Lockup } from "./ui/Logo";
import { Kbd, cn } from "./ui/primitives";

/** Desktop: the window's own title bar (drag area + window buttons). Web: a plain page header. */
export function TitleBar({ kind }: { kind: AppKind }) {
  const desktop = kind === "desktop";
  const [maximized, setMaximized] = useState(false);
  const setPalette = useNav((s) => s.setPalette);
  const user = useSession((s) => s.user);

  useEffect(() => {
    if (!desktop) return;
    let off: (() => void) | undefined;
    let gone = false;
    windowControls.isMaximized().then(setMaximized);
    // The listener is registered asynchronously; if we unmounted meanwhile, remove it right away.
    windowControls.onResized(() => windowControls.isMaximized().then(setMaximized)).then((u) => (gone ? u() : (off = u)));
    return () => {
      gone = true;
      off?.();
    };
  }, [desktop]);

  // The 1px window frame (index.css) is pointless when the window fills the screen.
  useEffect(() => {
    document.documentElement.classList.toggle("maximized", maximized);
  }, [maximized]);

  return (
    <header
      data-tauri-drag-region={desktop || undefined}
      className={cn("relative z-10 flex h-[60px] shrink-0 items-center border-b border-line bg-bg pl-4 shadow-[0_1px_2px_rgb(13_27_42/0.03)]", desktop ? "pr-2" : "pr-4")}
      onDoubleClick={(e) => desktop && e.target === e.currentTarget && windowControls.toggleMaximize()}
    >
      <div data-tauri-drag-region={desktop || undefined} className="pointer-events-none">
        <Lockup />
      </div>

      {user && (
        <button
          onClick={() => setPalette(true)}
          className="absolute left-1/2 flex h-9 w-[min(400px,34vw)] -translate-x-1/2 items-center gap-2 rounded-[10px] border border-transparent bg-sunken px-3 text-[13px] text-ink-3 transition-[border-color,background-color,box-shadow] hover:border-line hover:bg-raised hover:shadow-xs"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">ძებნა</span>
          <span className="flex gap-0.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      )}

      {user && (
        <div className="ml-auto">
          <UserMenu user={user} canSignOut={!desktop} />
        </div>
      )}

      {desktop && user && <span aria-hidden className="mx-2.5 h-6 w-px bg-line" />}
      {desktop && <div className={cn("flex items-center gap-0.5", !user && "ml-auto")}>
        <WinButton label="ჩაკეცვა" onClick={windowControls.minimize}>
          <path d="M0 5h10" />
        </WinButton>
        <WinButton label={maximized ? "აღდგენა" : "გაშლა"} onClick={windowControls.toggleMaximize}>
          {maximized ? (
            <>
              <rect x="0.5" y="2.5" width="7" height="7" />
              <path d="M2.5 2.5v-2h7v7h-2" />
            </>
          ) : (
            <rect x="0.5" y="0.5" width="9" height="9" />
          )}
        </WinButton>
        <WinButton label="დახურვა" onClick={windowControls.close} danger>
          <path d="M0 0l10 10M10 0L0 10" />
        </WinButton>
      </div>}
    </header>
  );
}

function WinButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid h-8 w-10 place-items-center rounded-[8px] text-ink-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent",
        danger ? "hover:bg-[#c42b1c] hover:text-white active:bg-[#b02718]" : "hover:bg-ink/[0.06] hover:text-ink active:bg-ink/[0.1]",
      )}
    >
      <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
