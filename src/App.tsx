import { useEffect } from "react";
import { Toaster } from "sonner";
import { RefreshCw, WifiOff } from "lucide-react";
import { CommandPalette } from "./components/CommandPalette";
import { Footer } from "./components/Footer";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { Lockup } from "./components/ui/Logo";
import { Button, Spinner } from "./components/ui/primitives";
import { useDeviceSession } from "./hooks/useDeviceSession";
import { useNotifier } from "./hooks/useNotifier";
import { appKind, HAS_EMPLOYEE, HAS_STAFF, type AppKind } from "./lib/target";
import type { User } from "./lib/types";
import { useNav } from "./store/nav";
import { applyTheme, isStaff, useSession } from "./store/session";
import { Dashboard } from "./views/Dashboard";
import { Journal } from "./views/Journal";
import { MyRequests } from "./views/MyRequests";
import { Report } from "./views/Report";
import { Sla } from "./views/Sla";
import { Login } from "./views/Login";
import { NewTicket } from "./views/NewTicket";
import { TicketsView } from "./views/Queue";
import { Settings } from "./views/Settings";

export default function App() {
  const user = useSession((s) => s.user);
  const theme = useSession((s) => s.theme);
  const kind = appKind(useSession((s) => s.previewAs));

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("web", kind === "web");
  }, [kind]);

  // The web app is for IT staff only; an employee token (e.g. left over in storage) is dropped.
  const webUser = HAS_STAFF && kind === "web" && user && isStaff(user) ? user : null;

  return (
    <div className="flex h-full flex-col">
      {HAS_STAFF && kind === "web" && !webUser ? (
        <>
          <div className="min-h-0 flex-1">
            <Login />
          </div>
          <Footer />
        </>
      ) : (
        <>
          <TitleBar kind={kind} />
          <div className="min-h-0 flex-1">{webUser ? <Shell key={webUser.id} user={webUser} kind="web" /> : HAS_EMPLOYEE ? <DesktopApp /> : null}</div>
          <Footer />
        </>
      )}
      <Toaster
        position="bottom-right"
        offset={52}
        toastOptions={{
          className: "!font-sans !text-[13px] !bg-raised !text-ink !border-line !shadow-pop !rounded-[10px]",
          classNames: { actionButton: "!bg-accent !text-accent-ink !rounded-[7px] !font-medium", description: "!text-ink-3" },
        }}
      />
    </div>
  );
}

/** Employee app: signs itself in with the Windows account, no login screen. */
function DesktopApp() {
  const user = useSession((s) => s.user);
  const { state, retry } = useDeviceSession(true);

  if (user && state.status === "ready") return <Shell key={user.id} user={user} kind="desktop" />;
  return (
    <div className="grid h-full place-items-center bg-panel px-8">
      <div className="anim-fade flex max-w-sm flex-col items-center text-center">
        <Lockup size="lg" />
        {state.status === "error" ? (
          <>
            <WifiOff className="mt-8 size-6 text-ink-3" strokeWidth={1.6} />
            <p className="mt-3 text-[14px] font-medium">IT Support-თან დაკავშირება ვერ მოხერხდა</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{state.message}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">შეამოწმე ინტერნეტი, ან დარეკე IT სამსახურში.</p>
            <Button className="mt-5" icon={<RefreshCw className="size-3.5" />} onClick={retry}>
              თავიდან ცდა
            </Button>
          </>
        ) : (
          <p className="mt-8 flex items-center gap-2 text-[13px] text-ink-2">
            <Spinner className="size-3.5" />
            დაკავშირება
          </p>
        )}
      </div>
    </div>
  );
}

function Shell({ user, kind }: { user: User; kind: AppKind }) {
  const { view, scope, origin, go, setPalette } = useNav();
  // Desktop = employee views only; web = staff views only.
  const staff = HAS_STAFF && kind === "web";
  useNotifier(user);

  useEffect(() => {
    go(staff ? "dashboard" : "new", { ticketId: null });
  }, [staff, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k") setPalette(!useNav.getState().paletteOpen);
      else if (k === "n" && !staff) go("new");
      else if (k === ",") go("settings");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, setPalette, staff]);

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden bg-panel">
        {HAS_STAFF && view === "dashboard" && staff && <Dashboard viewer={user} />}
        {HAS_STAFF && view === "queue" && staff && <TicketsView key={origin ?? "-"} viewer={user} scope={scope} origin={origin} />}
        {HAS_STAFF && view === "journal" && staff && user.role === "admin" && <Journal viewer={user} />}
        {HAS_STAFF && view === "sla" && staff && user.role === "admin" && <Sla />}
        {HAS_STAFF && view === "report" && staff && user.role === "admin" && <Report />}
        {HAS_EMPLOYEE && view === "mine" && !staff && <MyRequests viewer={user} />}
        {HAS_EMPLOYEE && view === "new" && !staff && <NewTicket viewer={user} />}
        {view === "settings" && <Settings viewer={user} kind={kind} />}
      </main>
      <CommandPalette viewer={user} />
    </div>
  );
}
