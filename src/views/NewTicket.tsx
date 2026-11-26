import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Lock, Printer } from "lucide-react";
import { CAT_ICON } from "@/components/ui/categoryIcon";
import { useCreateTicket } from "@/api/queries";
import { Meter } from "@/components/ui/Meter";
import { Button, Input, Textarea, cn } from "@/components/ui/primitives";
import { rustdeskLabel, ticketNo } from "@/lib/format";
import { CATEGORY, CATEGORY_ORDER, MEDIA_LABEL, PRINTER_STATE } from "@/lib/labels";
import { pct } from "@/lib/health";
import { deviceSnapshot, requestRemoteAccess, rustdeskId, systemInfo } from "@/lib/tauri";
import type { Device, DeviceSnapshot, Ticket, TicketCategory, User } from "@/lib/types";
import { useNav } from "@/store/nav";
import { isStaff } from "@/store/session";

export function NewTicket({ viewer }: { viewer: User }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const snapPromise = useRef<Promise<DeviceSnapshot | null> | null>(null);
  /** undefined = still looking, null = RustDesk not installed. */
  const [remoteId, setRemoteId] = useState<string | null | undefined>(undefined);
  const remotePromise = useRef<Promise<string | null> | null>(null);
  const [created, setCreated] = useState<Ticket | null>(null);
  const [tried, setTried] = useState(false);
  const create = useCreateTicket();
  const go = useNav((s) => s.go);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    systemInfo().then(setDevice).catch(() => setDevice(null));
    // Start the computer check right away; it's ready by the time the form is filled in.
    snapPromise.current = deviceSnapshot()
      .then((s) => (setSnapshot(s), s))
      .catch(() => null)
      .finally(() => setChecking(false));
    remotePromise.current = rustdeskId()
      .catch(() => null)
      .then((id) => (setRemoteId(id), id));
    first.current?.focus();
  }, []);

  // Same order as on screen: category, title, description.
  const missing = !category ? "category" : !subject.trim() ? "subject" : !description.trim() ? "description" : null;

  const [sending, setSending] = useState(false);
  const submit = async () => {
    setTried(true);
    if (missing) {
      // Take the user to what is missing.
      const el = document.getElementById(missing === "category" ? "cat-label" : missing === "subject" ? "subject" : "desc");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (missing !== "category") el?.focus({ preventScroll: true });
    }
    if (missing || create.isPending || sending) return;
    setSending(true);
    // Wait for the computer check, but never longer than 20 s.
    const within = <T,>(p: Promise<T> | null, ms: number) =>
      Promise.race([p ?? Promise.resolve(null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
    const [snap, remote_id] = await Promise.all([within(snapPromise.current, 20_000), within(remotePromise.current, 10_000)]);
    create.mutate(
      {
        subject: subject.trim(),
        description: description.trim(),
        category: category!,
        device: device ?? { hostname: "unknown", username: viewer.username },
        snapshot: snap,
        remote_id,
      },
      {
        onSuccess: (t) => {
          setCreated(t);
          // A one-time RustDesk password for this ticket; the SYSTEM task sends it straight to the server.
          if (remote_id) void requestRemoteAccess(t.id);
        },
        onSettled: () => setSending(false),
      },
    );
  };

  const reset = () => {
    setSubject("");
    setDescription("");
    setCategory(null);
    setCreated(null);
    setTried(false);
    requestAnimationFrame(() => first.current?.focus());
  };

  if (created) {
    const open = () => go(isStaff(viewer) ? "queue" : "mine", { scope: isStaff(viewer) ? "all" : undefined, ticketId: created.id });
    return (
      <div className="grid h-full place-items-center bg-panel px-8">
        <div className="w-full max-w-md rounded-panel border border-line bg-raised px-10 py-10 text-center shadow-card anim-pop">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok/10 text-ok">
            <CheckCircle2 className="size-7" strokeWidth={1.7} />
          </span>
          <h2 className="title-light mt-5 text-[24px]">მოთხოვნა <span className="mono">{ticketNo(created.id)}</span> გაიგზავნა</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
            IT სამსახური უკვე ხედავს მას. სტატუსის შეცვლისას შეტყობინებას მიიღებ, მიმდინარეობას კი „ჩემი მოთხოვნები“-ში ნახავ.
          </p>
          <div className="mt-7 flex justify-center gap-2">
            <Button variant="primary" onClick={open} className="h-10 rounded-field px-4 text-[13.5px]">მოთხოვნის ნახვა</Button>
            <Button onClick={reset} className="h-10 rounded-field px-4 text-[13.5px]">კიდევ ერთი მოთხოვნა</Button>
          </div>
        </div>
      </div>
    );
  }

  const label = "flex items-center gap-2 text-[13px] font-semibold text-ink";
  return (
    <div className="h-full overflow-y-auto bg-panel">
      <div className="flex min-h-full gap-6 px-8 py-7 max-[900px]:flex-col max-[900px]:px-5">
        <form
          className="@container flex min-w-0 flex-1 flex-col rounded-panel border border-line bg-raised px-9 pt-8 pb-8 shadow-card anim-up max-[900px]:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) submit();
          }}
        >
          <h1 className="title-light text-[28px]">რა პრობლემა გაქვს?</h1>
          <p className="mt-1.5 text-[14px] text-ink-2">აღწერე მოკლედ, დანარჩენს IT თვითონ გაარკვევს.</p>

          <p id="cat-label" className={cn(label, "mt-7 mb-2")}>რას ეხება</p>
          <div role="radiogroup" aria-labelledby="cat-label" aria-invalid={tried && missing === "category"} className="grid grid-cols-4 gap-2.5 @max-[560px]:grid-cols-3 @max-[400px]:grid-cols-2">
            {CATEGORY_ORDER.map((c) => {
              const on = category === c;
              return (
                <button
                  type="button"
                  key={c}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "group flex h-[84px] flex-col items-center justify-center gap-2 rounded-tile border px-2 text-[13px] transition-[border-color,box-shadow,background-color,color] duration-150",
                    on
                      ? "border-accent font-semibold text-accent shadow-[0_0_0_3px_var(--ring)]"
                      : "border-line bg-raised text-ink-2 hover:border-line-strong hover:bg-hover hover:text-ink",
                    tried && missing === "category" && !on && "border-critical/50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-[34px] place-items-center rounded-item transition-colors [&>svg]:size-[18px] [&>svg]:stroke-[1.7]",
                      on ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent",
                    )}
                  >
                    {CAT_ICON[c]}
                  </span>
                  <span className="max-w-full truncate">{CATEGORY[c]}</span>
                </button>
              );
            })}
          </div>

          <label htmlFor="subject" className={cn(label, "mt-6 mb-2")}>მოკლე სათაური</label>
          <Input
            id="subject"
            ref={first}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="მაგ.: პრინტერი არ ბეჭდავს"
            maxLength={140}
            aria-invalid={tried && missing === "subject"}
            className={cn("h-[46px] rounded-field px-4 text-[14.5px]", tried && missing === "subject" && "border-critical")}
          />

          <label htmlFor="desc" className={cn(label, "mt-6 mb-2")}>დაწვრილებით</label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="რა გააკეთე, რა შეცდომა გამოჩნდა, როდიდან ხდება."
            aria-invalid={tried && missing === "description"}
            className={cn("min-h-[132px] flex-1 resize-none rounded-tile px-3.5 py-3 text-[14.5px] leading-relaxed", tried && missing === "description" && "border-critical")}
          />

          <div className="mt-6 flex items-center gap-4">
            {tried && missing && (
              <span role="alert" className="text-[13px] text-critical">
                {missing === "subject" ? "დაწერე სათაური." : missing === "category" ? "აირჩიე, რას ეხება პრობლემა." : "აღწერე პრობლემა."}
              </span>
            )}
            <Button
              type="submit"
              variant="primary"
              loading={create.isPending || sending}
              className="ml-auto h-12 gap-2.5 rounded-field px-6 text-[14.5px] font-semibold"
            >
              {sending && checking ? "კომპიუტერის შემოწმება" : "მოთხოვნის გაგზავნა"}
              {!(create.isPending || sending) && <ArrowRight className="size-[17px]" strokeWidth={2} />}
            </Button>
          </div>
        </form>

        <aside className="flex w-[330px] shrink-0 flex-col rounded-panel border border-line bg-raised p-6 shadow-card anim-up max-[900px]:w-full">
          <p className="text-[15px] font-semibold">მოთხოვნას დაერთვება</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">IT დაინახავს კომპიუტერის მდგომარეობას და სისტემის ჟურნალს, ასე პრობლემას უფრო სწრაფად იპოვის.</p>
          <dl className="mt-5 space-y-3.5">
            <Info label="კომპიუტერი" value={device?.hostname} />
            <Info label="IP მისამართი" value={device?.ip} />
            <Info label="RustDesk ID" value={remoteId === undefined ? undefined : remoteId ? rustdeskLabel(remoteId) : "არ არის დაყენებული"} mono={!!remoteId} />
          </dl>
          <div className="mt-5 border-t border-line pt-5">
            {checking ? (
              <p className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <Loader2 className="size-3.5 animate-spin" />
                კომპიუტერის შემოწმება
              </p>
            ) : snapshot ? (
              <SnapshotSummary s={snapshot} />
            ) : (
              <p className="text-[12.5px] text-ink-3">მდგომარეობა ვერ წაიკითხა. მოთხოვნა მაინც გაიგზავნება.</p>
            )}
          </div>
          <div className="min-h-6 flex-1" />
          <p className="flex gap-2.5 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-3">
            <Lock className="mt-0.5 size-[15px] shrink-0" strokeWidth={1.7} />
            <span>
              სისტემის ჟურნალი (Event Log) ავტომატურად მიემაგრება.{remoteId ? " დისტანციური დახმარებისთვის ერთჯერადი პაროლი პირდაპირ IT-ს გადაეცემა." : ""}
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}

function SnapshotSummary({ s }: { s: DeviceSnapshot }) {
  const ram = pct(s.memory.used_gb, s.memory.total_gb);
  const sys = s.volumes.find((v) => v.letter.toUpperCase() === "C:") ?? s.volumes[0];
  const printer = s.printers.find((p) => p.is_default && !p.virtual) ?? s.printers.find((p) => !p.virtual);
  const media = [...new Set(s.disks.map((d) => MEDIA_LABEL[d.media]))];
  const printerOk = printer && printer.reachable !== false && (printer.state === "ready" || printer.state === "printing");
  return (
    <div className="space-y-3.5">
      <Row label="პროცესორი" value={`${s.cpu.load_percent}%`} meter={s.cpu.load_percent} />
      <Row label="RAM" value={`${ram}%`} meter={ram} />
      {sys && (
        <Row
          label={`დისკი ${sys.letter}`}
          badges={media}
          value={`${sys.free_gb.toFixed(0)} GB თავისუფ.`}
          meter={100 - pct(sys.free_gb, sys.total_gb)}
        />
      )}
      {printer && (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-tile px-3.5 py-2.5",
            printerOk ? "bg-sunken text-ink-2" : "bg-high/10 text-high",
          )}
          title={printer.name}
        >
          <Printer className="size-4 shrink-0" strokeWidth={1.7} />
          <div className="min-w-0">
            <p className={cn("truncate text-[12.5px] font-semibold", printerOk && "text-ink")}>{printer.name}</p>
            <p className="text-[12px]">{printer.reachable === false ? "არ პასუხობს" : PRINTER_STATE[printer.state]}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, meter, badges }: { label: string; value: string; meter: number; badges?: string[] }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px]">
        <span className="text-ink-2">{label}</span>
        {badges?.map((b) => (
          <span key={b} className="mono rounded-[4px] bg-sunken px-1.5 text-[10.5px] text-ink-2">{b}</span>
        ))}
        <span className="mono ml-auto text-ink">{value}</span>
      </div>
      <Meter value={meter} label={label} />
    </div>
  );
}

function Info({ label, value, mono = true }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-[14px]", mono && "mono")}>
        {value ?? <span className="inline-block h-3.5 w-28 animate-pulse rounded bg-sunken align-middle" />}
      </dd>
    </div>
  );
}
