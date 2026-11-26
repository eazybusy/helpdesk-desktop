import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { api } from "@/api";
import { Lockup } from "@/components/ui/Logo";
import { Button, cn } from "@/components/ui/primitives";
import { isStaff, useSession } from "@/store/session";

/** Web app sign-in — main admin and IT specialists only. Employees use the desktop app, which needs no login. */
export function Login() {
  const { setSession, useMock } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (e = email, p = password) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api().login(e.trim(), p, remember);
      if (!isStaff(res.user)) throw new Error("ვებ-სისტემა მხოლოდ IT პერსონალისთვისაა.");
      setSession(res.access_token, res.user, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : "შესვლა ვერ მოხერხდა.");
    } finally {
      setBusy(false);
    }
  };

  const demo = (e: string) => {
    setEmail(e);
    setPassword("demo");
    void signIn(e, "demo");
  };

  return (
    <div className="grid h-full place-items-center overflow-y-auto bg-panel bg-[radial-gradient(900px_420px_at_50%_-12%,var(--accent-soft),transparent_72%)] px-6 py-10">
      <div className="anim-pop w-full max-w-[420px] rounded-[20px] border border-line bg-raised px-9 pt-9 pb-8 shadow-float max-[480px]:px-6">
        <Lockup size="lg" className="justify-center" />
        <div className="mt-8 text-center">
          <h1 className="title-light text-[26px]">ავტორიზაცია</h1>
          <p className="mt-1 text-[13.5px] text-ink-2">შეიყვანეთ თქვენი მონაცემები</p>
        </div>

        <form
          className="mt-7 space-y-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            void signIn();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[13px] font-medium">ელ-ფოსტა</label>
            <IconInput icon={<Mail />}>
              <input
                id="email"
                type="email"
                autoFocus
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="example@gmail.com"
                autoComplete="username"
                className="peer h-11 w-full rounded-[10px] border border-line bg-raised pr-3 pl-10 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)]"
              />
            </IconInput>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[13px] font-medium">პაროლი</label>
            <IconInput icon={<Lock />}>
              <input
                id="password"
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="შეიყვანეთ პაროლი"
                autoComplete="current-password"
                className="peer h-11 w-full rounded-[10px] border border-line bg-raised pr-11 pl-10 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)]"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "პაროლის დამალვა" : "პაროლის ჩვენება"}
                aria-pressed={show}
                className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-[8px] text-ink-3 transition-colors hover:bg-ink/[0.05] hover:text-ink [&>svg]:size-[18px]"
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </IconInput>
          </div>

          <label className="flex w-fit items-center gap-2 text-[13px] text-ink-2 select-none">
            <input type="checkbox" checked={remember} onChange={(ev) => setRemember(ev.target.checked)} className="size-4 rounded accent-[var(--accent)]" />
            დამახსოვრება
          </label>

          {error && (
            <p role="alert" className="rounded-[10px] bg-critical/8 px-3 py-2 text-[12.5px] leading-relaxed text-critical">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" loading={busy} disabled={!email.trim() || !password} className="h-11 w-full text-[14px]">
            შესვლა
          </Button>
        </form>

        {useMock && (
          <div className="mt-7 border-t border-line pt-4">
            <p className="text-[12px] text-ink-3">სადემონსტრაციო რეჟიმი: ნებისმიერი პაროლი</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Button size="sm" onClick={() => demo("tornike@demo.local")}>მთავარი ადმინი</Button>
              <Button size="sm" onClick={() => demo("nino.beridze@demo.local")}>IT სპეციალისტი</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IconInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className={cn("pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3 transition-colors peer-focus:text-accent [&>svg]:size-[17px]")}>{icon}</span>
    </div>
  );
}
