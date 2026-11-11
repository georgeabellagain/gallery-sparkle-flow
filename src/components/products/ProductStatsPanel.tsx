import { useEffect, useState } from "react";
import { productAuth } from "@/lib/products/client";
import { productStats } from "@/lib/products/stats.functions";

type Stats = Awaited<ReturnType<typeof productStats>>;
const TILES = [
  ["preview_view", "Preview views"],
  ["buy_click", "Buy clicks"],
  ["customer_open", "Customer opens"],
  ["download", "Downloads"],
] as const;

/** Feature C: counts only, for the last 30 days and in total. No visitor details are kept. */
export function ProductStatsPanel({ id }: { id: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void productAuth()
      .then((headers) => productStats({ data: { id }, headers }))
      .then((s) => live && setStats(s))
      .catch((e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, [id]);
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!stats) return <p role="status" className="text-sm text-muted-foreground">Loading statistics…</p>;
  const month = Object.fromEntries(TILES.map(([k]) => [k, stats.days.reduce((n, d) => n + d[k], 0)])) as Record<(typeof TILES)[number][0], number>;
  const peak = Math.max(1, ...stats.days.map((d) => d.preview_view));
  return <div className="space-y-5">
    {!stats.available && <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Statistics start counting after the next update. Until then everything shows zero.</p>}
    <div className="grid grid-cols-2 gap-2">
      {TILES.map(([k, label]) => <div key={k} className="rounded-2xl border border-border p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{month[k]}</p>
        <p className="text-[11px] text-muted-foreground">Last 30 days · {stats.totals[k]} in total</p>
      </div>)}
    </div>
    {month.preview_view >= 20 && <p className="text-sm">Buy rate: {Math.round((month.buy_click / month.preview_view) * 100)}%</p>}
    <div>
      <p className="mb-2 text-xs text-muted-foreground">Preview views per day</p>
      <div className="flex h-20 items-end gap-[3px]" role="img" aria-label={`Preview views over the last 30 days: ${month.preview_view} in total`}>
        {stats.days.map((d) => <span key={d.day} title={`${d.day}: ${d.preview_view}`} className="flex-1 rounded-sm bg-leaf/70" style={{ height: `${Math.max(4, (d.preview_view / peak) * 100)}%`, opacity: d.preview_view ? 1 : 0.25 }} />)}
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Counts only: no names, addresses or cookies are kept for shoppers. Bots and link previews are not counted.</p>
  </div>;
}
