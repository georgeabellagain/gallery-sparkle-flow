import { useEffect, useMemo, useState } from "react";
import { Download, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { readingInsights, type ReadingRow } from "@/lib/portfolia/reading.functions";
import { duration, readingCsv, summariseReading, type Count } from "@/lib/portfolia/reading-insights";
import { isPaid, useDoc } from "@/lib/portfolia/store";
import { InfoTip } from "./InfoTip";

const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [365, "1 year"]] as const;

function Figure({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">{label}<InfoTip label={`About ${label}`}>{tip}</InfoTip></dt>
      <dd className="display-title mt-1 text-2xl tabular-nums">{value}</dd>
    </div>
  );
}
function Bars({ title, items, tip, empty }: { title: string; items: Count[]; tip: string; empty: string }) {
  const most = Math.max(1, ...items.map((i) => i.count));
  return (
    <div>
      <h4 className="flex items-center gap-1 text-xs font-medium">{title}<InfoTip label={`About ${title}`}>{tip}</InfoTip></h4>
      {items.length ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((i) => (
            <li key={i.name} className="text-xs">
              <div className="flex justify-between gap-2"><span className="truncate">{i.name}</span><span className="tabular-nums text-muted-foreground">{i.count}</span></div>
              <div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${(i.count / most) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-muted-foreground">{empty}</p>}
    </div>
  );
}

/**
 * Reader insights (Personal): how many people read a published portfolio, how far and for how long, which pages
 * hold attention, what they press and play, and their devices, countries and the sites they came from. Downloads as
 * a spreadsheet for reports.
 */
export function ReaderInsights({ code, pages, name }: { code: string; pages: number; name?: string }) {
  const doc = useDoc();
  const paid = isPaid(doc);
  const load = useServerFn(readingInsights);
  const [days, setDays] = useState<number>(30);
  const [rows, setRows] = useState<ReadingRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!paid) return;
    let live = true;
    setRows(null); setError("");
    load({ data: { code, days } }).then((r) => { if (live) setRows(r.rows); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "Couldn't load reader insights."); });
    return () => { live = false; };
  }, [code, days, paid, load]);
  const s = useMemo(() => (rows ? summariseReading(rows, pages) : null), [rows, pages]);
  const download = () => {
    if (!rows) return;
    const url = URL.createObjectURL(new Blob([readingCsv(rows)], { type: "text/csv" })), a = document.createElement("a");
    a.href = url; a.download = `${(name || code).replace(/[^a-zA-Z0-9_-]+/g, "-")}-reader-insights-${days}d.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!paid) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border p-4 text-sm">
        <p className="flex items-center gap-2 font-medium"><Lock className="size-4" aria-hidden />Reader insights<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal">Personal</span></p>
        <p className="mt-1 text-xs text-muted-foreground">See which pages people read and for how long, what they click and play, how far they get, and their devices, countries and where they came from. Download it all as a spreadsheet.</p>
      </div>
    );
  }
  const most = Math.max(1, ...(s?.pages.map((p) => p.views) ?? [1]));
  return (
    <section className="mt-8 space-y-5" aria-label="Reader insights">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 text-sm font-medium">Reader insights<InfoTip label="About reader insights">Counted from published portfolios opened by other people. Your own visits and previews are left out. No names or IP addresses are kept.</InfoTip></h3>
        <div className="flex items-center gap-1" role="group" aria-label="Time range">
          {RANGES.map(([d, label]) => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className="rounded-full px-2.5 py-1 text-xs aria-pressed:bg-foreground aria-pressed:text-background">{label}</button>)}
          <Button size="xs" variant="line" disabled={!rows?.length} onClick={download}><Download className="size-3.5" />CSV</Button>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {!s && !error && <p role="status" className="text-xs text-muted-foreground">Loading…</p>}
      {s && !s.readers && <p className="text-xs text-muted-foreground">No reading yet in this period. Share your link and the first readers show up here within a minute.</p>}
      {s && s.readers > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure label="Readers" value={String(s.readers)} tip="Different people (browsers) who opened the portfolio in this period." />
            <Figure label="Page views" value={String(s.pageViews)} tip="Every time a page (or spread) was opened." />
            <Figure label="Reading time" value={duration(s.averageSeconds)} tip="Average time each reader spent with the portfolio open and in view." />
            <Figure label="Reached the end" value={`${Math.round(s.finished * 100)}%`} tip="Share of readers who got to the last page or spread." />
          </dl>
          <div>
            <h4 className="flex items-center gap-1 text-xs font-medium">Pages<InfoTip label="About pages">Bar length is how often a page was opened; the time is how long readers stayed on it on average. Long, busy bars are your strongest pages.</InfoTip></h4>
            <ul className="mt-2 space-y-1">
              {s.pages.map((p) => (
                <li key={p.page} className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-2 text-xs">
                  <span className="tabular-nums text-muted-foreground">p. {p.page}</span>
                  <span className="h-2 rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(p.views / most) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{p.views} · {duration(p.averageSeconds)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Bars title="Clicks" items={s.clicks} tip="Links, hotspots, buttons and contents links readers pressed." empty="No clicks yet." />
            <Bars title="Video plays" items={s.plays} tip="YouTube and Vimeo videos started on your pages." empty="No plays yet." />
            <Bars title="Devices" items={s.devices} tip="Phone, tablet or computer, one per reader." empty="Not known yet." />
            <Bars title="Countries" items={s.countries} tip="Where readers were, from their connection, one per reader." empty="Not known yet." />
            <Bars title="Came from" items={s.sources} tip="The site readers clicked through from, such as instagram.com or linkedin.com. Direct means a typed link, a QR code, an app or an email." empty="Not known yet." />
          </div>
        </>
      )}
    </section>
  );
}
