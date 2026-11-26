import { useEffect, useMemo, useState } from "react";
import { AlarmClock, CircleCheck, Download, Inbox, Layers, Timer, Zap } from "lucide-react";
import { useReport } from "@/api/queries";
import { Figure, Figures, Legend, Page, Panel, RankBars, SplitBar, TrendChart } from "@/components/Board";
import { HandoffsPanel, handoffRows } from "@/components/Handoffs";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/marks";
import { Button, Segmented, Skeleton } from "@/components/ui/primitives";
import { PERIOD_LABEL, duration, localDate, periodStart, shortDate, type Period } from "@/lib/format";
import { CATEGORY, regionName } from "@/lib/labels";
import type { Origin, Report as ReportData, ReportQuery } from "@/lib/types";


const mins = (m: number | null) => (m == null ? "—" : duration(m * 60_000));

/** Admin: what is asked most, which problems are most common, and all the counts, for a period. */
export function Report() {
  const [period, setPeriod] = useState<Period>("30");
  const [origin, setOrigin] = useState<Origin | "">("");
  const [region, setRegion] = useState("");
  const today = localDate();
  const query = useMemo<ReportQuery>(
    () => ({ since: periodStart(Number(period), today), origin: origin || undefined, region: region || undefined }),
    [period, origin, region, today],
  );
  const report = useReport(query);
  const r = report.data;

  // Region choices: everything seen so far, so picking one region doesn't shrink the list to itself.
  const [regions, setRegions] = useState<string[]>([]);
  useEffect(() => {
    if (r && !region) setRegions((prev) => [...new Set([...prev, ...r.by_region.map((x) => x.region)])].sort((a, b) => regionName(a).localeCompare(regionName(b), "ka")));
  }, [r, region]);

  const scopeLabel = region ? regionName(region) : origin === "hq" ? "სათავო" : origin === "region" ? "რეგიონები" : "სათავო და რეგიონები";

  return (
    <Page>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="title-light text-[30px]">რეპორტი</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {scopeLabel} · {r ? range(r.since, r.until) : PERIOD_LABEL[period]}
          </p>
        </div>
        <Button icon={<Download className="size-3.5" />} onClick={() => r && exportCsv(r, scopeLabel)} disabled={!r}>
          CSV
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Segmented<Period> value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
        <Segmented<Origin | "">
          value={origin}
          onChange={(v) => {
            setOrigin(v);
            if (v === "hq") setRegion("");
          }}
          options={[
            { value: "", label: "ყველა" },
            { value: "hq", label: "სათავო" },
            { value: "region", label: "რეგიონები" },
          ]}
        />
        {origin !== "hq" && regions.length > 0 && (
          <div className="w-[190px]">
            <Dropdown<string>
              label="რეგიონი"
              value={region}
              onChange={(v) => {
                setRegion(v);
                if (v) setOrigin("region");
              }}
              options={[{ value: "", label: "ყველა რეგიონი" }, ...regions.map((x) => ({ value: x, label: regionName(x) }))]}
            />
          </div>
        )}
      </div>

      {!r ? (
        <ReportSkeleton />
      ) : (
        <div className={report.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Figures className="grid-flow-row grid-cols-3">
            <Figure icon={<Inbox />} label="შემოსული" value={r.totals.opened} />
            <Figure icon={<CircleCheck />} label="დასრულებული" value={r.totals.resolved} />
            <Figure icon={<Layers />} label="ახლა აქტიური" value={r.totals.open_now} />
            <Figure icon={<Timer />} label="საშ. დასრულება" value={mins(r.totals.avg_resolution_minutes)} />
            <Figure icon={<Zap />} label="საშ. პირველი პასუხი" value={mins(r.totals.avg_first_response_minutes)} />
            <Figure icon={<AlarmClock />} label="ვადაზე გვიან" value={r.totals.late} alert={r.totals.late > 0} />
          </Figures>

          <div className="mt-6 grid grid-cols-[1.55fr_1fr] gap-6 max-[1100px]:grid-cols-1">
            <Panel title={r.trend_unit === "week" ? "დინამიკა, კვირების მიხედვით" : "დინამიკა, დღეების მიხედვით"} aside={<Legend />}>
              <TrendChart data={r.trend} unit={r.trend_unit} height={262} />
            </Panel>
            <Panel title="სათავო და რეგიონები">
              <SplitBar
                parts={[
                  { label: "სათავო", value: r.by_origin.hq, tone: "chart-1" },
                  { label: "რეგიონები", value: r.by_origin.region, tone: "chart-2" },
                ]}
              />
              {r.by_region.length > 0 && (
                <div className="mt-5 border-t border-line pt-3">
                  <RankBars
                    total={r.by_origin.region}
                    items={r.by_region.slice(0, 6).map((x) => ({ key: x.region, label: regionName(x.region), value: x.opened }))}
                    onPick={(k) => {
                      setOrigin("region");
                      setRegion(k);
                    }}
                  />
                </div>
              )}
            </Panel>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6 max-[1100px]:grid-cols-1">
            <Panel title="ყველაზე ხშირი მოთხოვნები" aside={<Hint>რას წერენ თანამშრომლები</Hint>}>
              <RankBars
                total={r.totals.opened}
                items={r.top_subjects.map((x) => ({ key: x.subject, label: x.subject, sub: CATEGORY[x.category], value: x.count }))}
              />
            </Panel>
            <Panel title="ყველაზე ხშირი პრობლემები" aside={<Hint>Event Log-ის ანალიზით</Hint>}>
              <RankBars
                total={r.totals.opened}
                items={r.top_problems.map((x) => ({ key: x.problem, label: x.problem, value: x.count }))}
                empty="Event Log-მა პრობლემა ვერ ამოიცნო."
              />
            </Panel>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6 max-[1100px]:grid-cols-1">
            <Panel title="კატეგორიები" aside={<Hint>რაოდენობა · საშ. დრო</Hint>}>
              <RankBars
                total={r.totals.opened}
                items={r.by_category.map((x) => ({ key: x.category, label: CATEGORY[x.category], value: x.opened, note: shortMins(x.avg_resolution_minutes) }))}
              />
            </Panel>
            <Panel title="კომპიუტერები, ყველაზე მეტი მოთხოვნით">
              <RankBars
                total={r.totals.opened}
                items={r.top_devices.map((x) => ({
                  key: x.hostname,
                  label: x.hostname,
                  sub: [x.requester?.full_name, x.region ? regionName(x.region) : null].filter(Boolean).join(", "),
                  value: x.count,
                }))}
              />
            </Panel>
          </div>

          <Panel title="IT სპეციალისტები" className="mt-6" aside={<Hint>დასრულებული მოთხოვნები ამ პერიოდში</Hint>}>
            {r.by_agent.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-3">ამ პერიოდში დასრულებული მოთხოვნა არ არის.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-ink-3">
                    <th className="pb-2 font-normal">სპეციალისტი</th>
                    <th className="pb-2 text-right font-normal">დაასრულა</th>
                    <th className="pb-2 text-right font-normal">წილი</th>
                    <th className="pb-2 text-right font-normal">საშ. დრო</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.by_agent.map((a) => (
                    <tr key={a.agent.id}>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <Avatar user={a.agent} size={24} />
                          {a.agent.full_name}
                        </span>
                      </td>
                      <td className="tnum py-2 text-right font-medium">{a.resolved}</td>
                      <td className="tnum py-2 text-right text-ink-2">{r.totals.resolved ? Math.round((a.resolved / r.totals.resolved) * 100) : 0}%</td>
                      <td className="tnum py-2 text-right text-ink-2">{mins(a.avg_resolution_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <HandoffsPanel h={r.handoffs} className="mt-6" />
        </div>
      )}
    </Page>
  );
}

/** "11 ოქტ – 9 ნოე", with years once the period crosses a year boundary. */
function range(since: string, until: string) {
  const a = new Date(since);
  const b = new Date(Date.parse(until) - 1);
  const y = a.getFullYear() !== b.getFullYear();
  return `${shortDate(since)}${y ? ` ${a.getFullYear()}` : ""} – ${shortDate(b.toISOString())}${y ? ` ${b.getFullYear()}` : ""}`;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] text-ink-3">{children}</span>;
}

/** "1 სთ 20 წთ" is too long for the narrow note column: hours or minutes, rounded. */
function shortMins(m: number | null) {
  if (m == null) return undefined;
  if (m < 60) return `${Math.round(m)}წ`;
  if (m < 48 * 60) return `${Math.round(m / 60)}სთ`;
  return `${Math.round(m / 1440)}დ`;
}

function ReportSkeleton() {
  return (
    <>
      <div className="mt-7 grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-panel" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 rounded-panel" />
      <div className="mt-6 grid grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-panel" />
        <Skeleton className="h-72 rounded-panel" />
      </div>
    </>
  );
}

/** Every section of the report as one Excel-friendly CSV (UTF-8 BOM). */
function exportCsv(r: ReportData, scope: string) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows: (string | number | null | undefined)[][] = [
    ["რეპორტი", scope, `${r.since.slice(0, 10)} – ${r.until.slice(0, 10)}`],
    [],
    ["შემოსული", r.totals.opened],
    ["დასრულებული", r.totals.resolved],
    ["ახლა აქტიური", r.totals.open_now],
    ["ვადაზე გვიან", r.totals.late],
    ["საშ. დასრულება, წთ", r.totals.avg_resolution_minutes],
    ["საშ. პირველი პასუხი, წთ", r.totals.avg_first_response_minutes],
    ["სათავო", r.by_origin.hq],
    ["რეგიონები", r.by_origin.region],
    [],
    ["ყველაზე ხშირი მოთხოვნები", "კატეგორია", "რაოდენობა"],
    ...r.top_subjects.map((x) => [x.subject, CATEGORY[x.category], x.count]),
    [],
    ["ყველაზე ხშირი პრობლემები (Event Log)", "რაოდენობა"],
    ...r.top_problems.map((x) => [x.problem, x.count]),
    [],
    ["კატეგორია", "რაოდენობა", "საშ. დასრულება, წთ"],
    ...r.by_category.map((x) => [CATEGORY[x.category], x.opened, x.avg_resolution_minutes]),
    [],
    ["რეგიონი", "შემოსული", "დასრულებული"],
    ...r.by_region.map((x) => [regionName(x.region), x.opened, x.resolved]),
    [],
    ["კომპიუტერი", "თანამშრომელი", "რაოდენობა"],
    ...r.top_devices.map((x) => [x.hostname, x.requester?.full_name, x.count]),
    [],
    ["სპეციალისტი", "დაასრულა", "საშ. დასრულება, წთ"],
    ...r.by_agent.map((x) => [x.agent.full_name, x.resolved, x.avg_resolution_minutes]),
    [],
    [r.trend_unit === "week" ? "კვირა" : "დღე", "შემოსული", "დასრულებული"],
    ...r.trend.map((x) => [x.date, x.created, x.resolved]),
    [],
    ...handoffRows(r.handoffs),
  ];
  const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `helpdesk-report-${localDate()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
