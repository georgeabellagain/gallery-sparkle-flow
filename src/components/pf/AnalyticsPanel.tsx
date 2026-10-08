import { useState } from "react";
import type { Analytics } from "@/lib/portfolia/store";

export function AnalyticsPanel({ data, title = "Portfolio statistics", description }: { data: Analytics; title?: string; description?: string }) {
  const [range, setRange] = useState<7 | 30 | 0>(0);
  const since = range ? Date.now() - range * 864e5 : 0;
  const visits = data.visits.filter((v) => v.t >= since);
  const uniques = new Set(visits.map((v) => v.v).filter(v => v && v !== "unknown")).size;
  const downloads = data.downloads.filter((t) => t >= since).length;
  const days = range || Math.max(7, Math.ceil((Date.now() - data.visits.reduce((first, visit) => Math.min(first, visit.t), Date.now())) / 864e5) + 1);
  const buckets = Array.from({ length: Math.min(days, 90) }, (_, i) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const s = start.getTime() - (Math.min(days, 90) - 1 - i) * 864e5;
    return visits.filter((v) => v.t >= s && v.t < s + 864e5).length;
  });
  const max = Math.max(1, ...buckets);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <div role="group" aria-label="Time range" className="flex gap-1 text-xs">
          {([[7, "7 days"], [30, "30 days"], [0, "All time"]] as const).map(([r, l]) => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`rounded-full border px-3 py-1 ${range === r ? "border-foreground" : "border-border text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>
      {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
      <dl className="mt-5 grid grid-cols-3 gap-4">
        <Stat label="Visits" value={visits.length} />
        <Stat label="Unique visitors (est.)" value={uniques} />
        <Stat label="Download clicks" value={downloads} />
      </dl>
      <div className="mt-6 flex h-24 items-end gap-px" role="img" aria-label={`Visits per day, ${visits.length} total`}>
        {buckets.map((b, i) => <div key={i} className="flex-1 bg-foreground/70" style={{ height: `${(b / max) * 100}%`, minHeight: b ? 2 : 1, opacity: b ? 1 : 0.15 }} />)}
      </div>
      <details className="mt-4 text-xs leading-relaxed text-muted-foreground"><summary className="cursor-pointer">How statistics are counted</summary><p className="mt-2">
        {range === 0 && <>All-time totals; the chart shows up to the last 90 days. </>}
        A visit is one viewing session — scrolling, zooming or loading more pages doesn’t add visits. Your own previews and known bots are excluded. Unique visitors are estimated per browser. Download clicks count button presses, not completed downloads. Statistics can’t identify who visited or show whether anyone read your work.
        
      </p></details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="display-title text-3xl tabular-nums">{value}</dd>
    </div>
  );
}

