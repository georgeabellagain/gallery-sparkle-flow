import { useEffect, useState } from "react";
/** A slider and editable percentage share one bounded value; an empty/incomplete number stays local until committed. */
export function NumberSlider({ label, value, max = 100, onChange }: { label: string; value: number; max?: number; onChange: (value: number) => void }) {
  const bounded = Math.max(0, Math.min(max, Math.round(value)));
  const [text, setText] = useState(String(bounded));
  useEffect(() => setText(String(bounded)), [bounded]);
  const commit = () => {
    const number = text.trim() ? Number(text) : NaN;
    if (!Number.isFinite(number)) { setText(String(bounded)); return; }
    const next = Math.max(0, Math.min(max, Math.round(number)));
    setText(String(next)); onChange(next);
  };
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      <label className="flex items-center gap-1"><span className="sr-only">{label} percentage</span>
        <input type="number" min={0} max={max} step={1} value={text} onChange={event => setText(event.target.value)} onBlur={commit}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } else if (event.key === "Escape") setText(String(bounded)); }}
          className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-right tabular-nums" /><span aria-hidden>%</span>
      </label>
    </div>
    <input type="range" aria-label={label} min={0} max={max} step={1} value={bounded} onChange={event => onChange(Number(event.target.value))} className="w-full accent-leaf" />
  </div>;
}
