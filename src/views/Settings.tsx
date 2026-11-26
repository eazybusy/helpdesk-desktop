import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { Button, Segmented, Switch } from "@/components/ui/primitives";
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
          <Row label={kind === "web" ? "ბრაუზერის შეტყობინებები" : "Windows-ის შეტყობინებები"} hint={viewer.role === "admin" ? "ახალი და გასანაწილებელი მოთხოვნის მოსვლისას." : isStaff(viewer) ? "ახალ მოთხოვნაზე და როცა მოთხოვნას შენზე გადმოწერენ." : "როცა მოთხოვნას IT-ში ვინმე აიღებს, დაასრულებს ან ხელახლა გახსნის. ფანჯრის დახურვის შემდეგაც (აპი საათთან, ხატულად რჩება)."}>
            <Switch checked={s.notifications} onChange={(v) => s.set({ notifications: v })} label="შეტყობინებები" />
          </Row>
          <Row label="შემოწმება">
            <Button size="sm" onClick={() => notify("HelpDesk", "შეტყობინებები მუშაობს.")}>სატესტო შეტყობინება</Button>
          </Row>
        </Group>


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
