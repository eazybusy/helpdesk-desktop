import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, MessageSquareText, Plus, Search, SendHorizontal, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useAddComment, useReplies, useSaveReply } from "@/api/queries";
import { dateTime, relative, ticketNo } from "@/lib/format";
import type { CannedReply, TicketDetail, User } from "@/lib/types";
import { useNav } from "@/store/nav";
import { isStaff } from "@/store/session";
import { Avatar } from "./ui/marks";
import { Button, Input, Textarea, cn } from "./ui/primitives";

/** {სახელი} → the employee's first name, {ნომერი} → the ticket number. */
const PLACEHOLDERS = ["{სახელი}", "{ნომერი}"];
function fillReply(body: string, t: Pick<TicketDetail, "id" | "requester">) {
  const first = t.requester.full_name.trim().split(/\s+/)[0] ?? "";
  return body.replaceAll("{სახელი}", first).replaceAll("{ნომერი}", ticketNo(t.id));
}

/**
 * Comments IT wrote on the ticket. The employee sees them in the app (and was notified);
 * IT also gets the box to write one, with the team's ready-made replies.
 */
export function Comments({ t, viewer }: { t: TicketDetail; viewer: User }) {
  const staff = isStaff(viewer);
  if (!staff && t.comments.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold tracking-[0.02em] text-ink-3">
        {staff ? "კომენტარები თანამშრომლისთვის" : "IT-ის კომენტარები"}
        {t.comments.length > 0 && <span className="tnum font-normal">{t.comments.length}</span>}
      </h3>
      {t.comments.length > 0 && (
        <ol className="space-y-2.5">
          {t.comments.map((c) => (
            <li key={c.id} className="anim-up rounded-[12px] border border-accent/25 bg-accent-soft/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Avatar user={c.author} size={22} />
                <span className="text-[13px] font-medium">{c.author.id === viewer.id ? "შენ" : c.author.full_name}</span>
                <span className="rounded-full bg-accent/12 px-1.5 py-px text-[10.5px] font-semibold text-accent">IT</span>
                <time className="text-[12px] text-ink-3" dateTime={c.at} title={dateTime(c.at)}>
                  {relative(c.at)}
                </time>
              </div>
              <p data-selectable className="mt-1.5 text-[14px] leading-[1.65] whitespace-pre-wrap">
                {c.body}
              </p>
            </li>
          ))}
        </ol>
      )}
      {staff && (
        <>
          <Composer t={t} />
          <ComposerHint />
        </>
      )}
    </section>
  );
}

function Composer({ t }: { t: TicketDetail }) {
  const [text, setText] = useState("");
  const [picker, setPicker] = useState<null | "pick" | "save">(null);
  const add = useAddComment(t.id);
  const box = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const body = text.trim();
    if (!body || add.isPending) return;
    add.mutate(body, {
      onSuccess: () => {
        setText("");
        toast.success("კომენტარი გაიგზავნა", { description: `${t.requester.full_name} ნახავს და შეტყობინება მიუვა.` });
      },
    });
  };

  const insert = (r: CannedReply) => {
    const filled = fillReply(r.body, t);
    setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n${filled}` : filled));
    setPicker(null);
    requestAnimationFrame(() => box.current?.focus());
  };

  return (
    <div className={cn("rounded-[12px] border border-line bg-raised shadow-xs focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--ring)]", t.comments.length > 0 && "mt-3")}>
      <Textarea
        ref={box}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={3}
        maxLength={4000}
        placeholder={`კომენტარი ${t.requester.full_name}-სთვის: რას გააკეთებს, რატომ დაიხურა, ვის მიმართოს…`}
        className="max-h-[240px] min-h-[84px] !rounded-b-none border-0 bg-transparent shadow-none [field-sizing:content] focus:border-0 focus:shadow-none"
      />
      <div className="relative flex flex-wrap items-center gap-1 border-t border-line px-2 py-1.5">
        <Button size="sm" variant="ghost" icon={<MessageSquareText className="size-3.5" />} onClick={() => setPicker(picker === "pick" ? null : "pick")} aria-expanded={picker === "pick"}>
          მზა პასუხები
        </Button>
        {text.trim() && (
          <Button size="sm" variant="ghost" icon={<BookmarkPlus className="size-3.5" />} onClick={() => setPicker(picker === "save" ? null : "save")} aria-expanded={picker === "save"}>
            შენახვა მზა პასუხად
          </Button>
        )}
        <Button size="sm" variant="primary" className="ml-auto" icon={<SendHorizontal className="size-3.5" />} onClick={send} disabled={!text.trim()} loading={add.isPending}>
          გაგზავნა
        </Button>
        {picker && (
          <Popover onClose={() => setPicker(null)}>
            {picker === "pick" ? <ReplyList onPick={insert} /> : <ReplyForm initial={{ title: "", body: text.trim() }} onDone={() => setPicker(null)} />}
          </Popover>
        )}
      </div>
    </div>
  );
}

/** Under the box: who will see it. */
function ComposerHint() {
  return <p className="mt-1.5 px-1 text-[11.5px] text-ink-3">თანამშრომელი ნახავს აპში და შეტყობინება მიუვა · გაგზავნა: Ctrl+Enter</p>;
}

function Popover({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // On the next tick, so the click that opened it doesn't close it.
    const id = setTimeout(() => document.addEventListener("mousedown", onDown));
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div ref={root} className="anim-pop absolute bottom-full left-1 z-50 mb-1.5 w-[400px] max-w-[calc(100vw-48px)] rounded-[12px] bg-raised p-2 shadow-pop">
      {children}
    </div>
  );
}

/** Pick a ready-made reply: search, a list, and the way to add or manage them. */
function ReplyList({ onPick }: { onPick: (r: CannedReply) => void }) {
  const replies = useReplies();
  const go = useNav((s) => s.go);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (replies.data ?? []).filter((r) => !k || `${r.title} ${r.body}`.toLowerCase().includes(k));
  }, [replies.data, q]);

  if (adding) return <ReplyForm initial={{ title: "", body: "" }} onDone={() => setAdding(false)} />;

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-ink-3" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="მოძებნე მზა პასუხი" className="h-8 pl-8 text-[13px]" />
      </div>
      <ul className="mt-1.5 max-h-[260px] overflow-y-auto">
        {replies.isLoading && <li className="px-2.5 py-3 text-[12.5px] text-ink-3">იტვირთება…</li>}
        {replies.data && list.length === 0 && <li className="px-2.5 py-3 text-[12.5px] text-ink-3">{q ? "ვერაფერი მოიძებნა." : "მზა პასუხი ჯერ არ არის."}</li>}
        {list.map((r) => (
          <li key={r.id}>
            <button onClick={() => onPick(r)} className="block w-full rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-ink/[0.055]">
              <span className="block truncate text-[13px] font-medium">{r.title}</span>
              <span className="block truncate text-[12px] text-ink-3">{r.body}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-center gap-1 border-t border-line pt-1.5">
        <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
          ახალი მზა პასუხი
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" icon={<Settings2 className="size-3.5" />} onClick={() => go("settings")}>
          მართვა
        </Button>
      </div>
    </div>
  );
}

/** New or edited ready-made reply. Used in the comment box and in Settings. */
export function ReplyForm({ initial, onDone }: { initial: { id?: number; title: string; body: string }; onDone: () => void }) {
  const save = useSaveReply();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const ok = title.trim() && body.trim();
  const submit = () => {
    if (!ok) return;
    save.mutate({ id: initial.id, title, body }, { onSuccess: () => (toast.success(initial.id ? "მზა პასუხი შეიცვალა" : "მზა პასუხი დაემატა"), onDone()) });
  };
  return (
    <div className="space-y-2">
      <Input autoFocus={!initial.title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="სათაური, მაგ. „არ ეხება IT-ს“" className="h-8 text-[13px]" />
      <Textarea
        autoFocus={!!initial.title}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit()}
        rows={4}
        maxLength={4000}
        placeholder="ტექსტი"
        className="text-[13px]"
      />
      <p className="text-[11.5px] leading-relaxed text-ink-3">
        ჩასმისას <code className="mono text-ink-2">{PLACEHOLDERS[0]}</code> ხდება თანამშრომლის სახელი, <code className="mono text-ink-2">{PLACEHOLDERS[1]}</code> — მოთხოვნის ნომერი.
      </p>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onDone}>
          გაუქმება
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={!ok} loading={save.isPending}>
          შენახვა
        </Button>
      </div>
    </div>
  );
}
