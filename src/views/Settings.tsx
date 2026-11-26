import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Moon, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteReply, useReplies } from "@/api/queries";
import { ReplyForm } from "@/components/Comments";
import { Button, IconButton, Segmented, Skeleton, Switch } from "@/components/ui/primitives";
import type { AppKind } from "@/lib/target";
import { notify } from "@/lib/tauri";
import type { User } from "@/lib/types";
import { isStaff, useSession, type Theme } from "@/store/session";

export function Settings({ viewer, kind }: { viewer: User; kind: AppKind }) {
  const s = useSession();
  const qc = useQueryClient();
  const setTheme = (theme: Theme) => s.set({ theme }); // App applies it to the document

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[640px] px-10 py-9">
        <h1 className="title-light text-[30px]">პარამეტრები</h1>

        <Group title="იერსახე">
          <Row label="თემა" hint="„სისტემური“ მიჰყვება Windows-ის პარამეტრს.">
            <Segmented<Theme>
              value={s.theme}
              onChange={setTheme}
              options={[
                { value: "light", label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" />ღია</span> },
                { value: "dark", label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" />მუქი</span> },
                { value: "system", label: <span className="flex items-center gap-1.5"><Monitor className="size-3.5" />სისტემური</span> },
              ]}
            />
          </Row>
        </Group>

        <Group title="შეტყობინებები">
          <Row label={kind === "web" ? "ბრაუზერის შეტყობინებები" : "Windows-ის შეტყობინებები"} hint={viewer.role === "admin" ? "ახალი და გასანაწილებელი მოთხოვნის მოსვლისას." : isStaff(viewer) ? "ახალ მოთხოვნაზე და როცა მოთხოვნას შენზე გადმოწერენ." : "როცა IT დაწერს კომენტარს, მოთხოვნას აიღებს, დაასრულებს ან ხელახლა გახსნის. ფანჯრის დახურვის შემდეგაც (აპი საათთან, ხატულად რჩება)."}>
            <Switch checked={s.notifications} onChange={(v) => s.set({ notifications: v })} label="შეტყობინებები" />
          </Row>
          <Row label="შემოწმება">
            <Button size="sm" onClick={() => notify("HelpDesk", "შეტყობინებები მუშაობს.")}>სატესტო შეტყობინება</Button>
          </Row>
        </Group>


        {isStaff(viewer) && <Replies viewer={viewer} />}

        <Group title="ანგარიში">
          {kind === "web" ? (
            <Row label={viewer.full_name} hint={`${viewer.username}${viewer.role === "admin" ? ", მთავარი ადმინი" : ", IT სპეციალისტი"}`}>
              <Button size="sm" variant="danger" icon={<LogOut className="size-3.5" />} onClick={() => { s.logout(); qc.clear(); }}>
                გასვლა
              </Button>
            </Row>
          ) : (
            <Row label={viewer.full_name} hint={`Windows-ის ანგარიში: ${viewer.username}. აპი ავტომატურად შედის, პაროლი არ სჭირდება.`}>
              <span />
            </Row>
          )}
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="eyebrow mb-2 px-1">{title}</h2>
      <div data-solid className="divide-y divide-line rounded-panel border border-line bg-raised px-5 shadow-card">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-6 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** The IT team's ready-made replies for comments: anyone in IT adds, the author or the admin edits and removes. */
function Replies({ viewer }: { viewer: User }) {
  const replies = useReplies();
  const remove = useDeleteReply();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const mayEdit = (authorId: number) => authorId === viewer.id || viewer.role === "admin";

  return (
    <section className="mt-7">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="eyebrow">მზა პასუხები</h2>
        {editing !== "new" && (
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setEditing("new")}>
            ახალი
          </Button>
        )}
      </div>
      <div data-solid className="divide-y divide-line rounded-panel border border-line bg-raised px-5 shadow-card">
        {editing === "new" && (
          <div className="py-4">
            <ReplyForm initial={{ title: "", body: "" }} onDone={() => setEditing(null)} />
          </div>
        )}
        {!replies.data ? (
          <Skeleton className="my-4 h-16" />
        ) : replies.data.length === 0 && editing !== "new" ? (
          <p className="py-5 text-[13px] text-ink-3">მზა პასუხი ჯერ არ არის. დაამატე და კომენტარში ერთი დაჭერით ჩასვამ.</p>
        ) : (
          replies.data.map((r) =>
            editing === r.id ? (
              <div key={r.id} className="py-4">
                <ReplyForm initial={r} onDone={() => setEditing(null)} />
              </div>
            ) : (
              <div key={r.id} className="group flex items-start gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{r.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-3">{r.body}</p>
                  <p className="mt-1 text-[11.5px] text-ink-3">{r.author.id === viewer.id ? "შენი" : r.author.full_name}</p>
                </div>
                {mayEdit(r.author.id) &&
                  (confirm === r.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                        არა
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={remove.isPending}
                        onClick={() => remove.mutate(r.id, { onSuccess: () => (toast.success("მზა პასუხი წაიშალა"), setConfirm(null)) })}
                      >
                        წაშლა
                      </Button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <IconButton label="რედაქტირება" onClick={() => setEditing(r.id)}>
                        <Pencil className="size-3.5" />
                      </IconButton>
                      <IconButton label="წაშლა" onClick={() => setConfirm(r.id)}>
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </span>
                  ))}
              </div>
            ),
          )
        )}
      </div>
      <p className="mt-2 px-1 text-[12px] leading-relaxed text-ink-3">
        ჩასმისას <code className="mono">{"{სახელი}"}</code> ხდება თანამშრომლის სახელი, <code className="mono">{"{ნომერი}"}</code> — მოთხოვნის ნომერი. გუნდის ყველა წევრი ხედავს.
      </p>
    </section>
  );
}
