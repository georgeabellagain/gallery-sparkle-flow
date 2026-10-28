import { useEffect, useState } from "react";
import { alignExtra, extraBox, nudgeStep, type PageAlignment } from "@/lib/portfolia/extra-placement";
import { transformExtra, type Extra, type ExtraKind } from "@/lib/portfolia/scrapbook-transform";
export function ExtraPositionControls({ kind, item, ratio, onChange }: { kind: ExtraKind; item: Extra; ratio: number; onChange: (item: Extra) => void }) {
  const box = extraBox(kind, item, ratio);
  const [x, setX] = useState(String(Math.round(box.x * 1000) / 10)), [y, setY] = useState(String(Math.round(box.y * 1000) / 10));
  useEffect(() => { setX(String(Math.round(box.x * 1000) / 10)); setY(String(Math.round(box.y * 1000) / 10)); }, [item.id, box.x, box.y]);
  const commit = () => {
    const nextX = x.trim() ? Number(x) / 100 : NaN, nextY = y.trim() ? Number(y) / 100 : NaN;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) { setX(String(box.x * 100)); setY(String(box.y * 100)); return; }
    const next = transformExtra(kind, item, nextX - box.x, nextY - box.y, "move", ratio);
    const placed = extraBox(kind, next, ratio);
    setX(String(Math.round(placed.x * 1000) / 10)); setY(String(Math.round(placed.y * 1000) / 10));
    onChange(next);
  };
  const alignments: readonly [PageAlignment, string][] = kind === "tags" ? [["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]] : [["left", "Left"], ["center", "Centre"], ["right", "Right"], ["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]];
  return <fieldset className="space-y-2 rounded-xl border border-border p-3 text-xs">
    <legend className="px-1 font-medium">Position selected item</legend>
    <div className="grid grid-cols-3 gap-1">{alignments.map(([alignment, label]) => <button type="button" key={alignment} className="rounded-lg border border-border px-2 py-1.5 hover:bg-muted" onClick={() => onChange(alignExtra(kind, item, alignment, ratio))}>{label}</button>)}</div>
    <div className="flex gap-2">{([["x", "Left", x, setX], ["y", kind === "tags" ? "Edge position" : "Top", y, setY]] as const).filter(([key]) => kind !== "tags" || key !== "x").map(([key, label, value, set]) => <label key={key} className="min-w-0 flex-1">{label} %<input type="number" min={0} max={100} step={.1} value={value} onChange={event => set(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5" /></label>)}</div>
    <div className="flex gap-1" role="group" aria-label="Nudge selected item">{([["←", -1, 0, "left"], ["↑", 0, -1, "up"], ["↓", 0, 1, "down"], ["→", 1, 0, "right"]] as const).filter(([, dx]) => kind !== "tags" || !dx).map(([label, dx, dy, direction]) => <button key={direction} type="button" aria-label={`Nudge ${direction}`} className="flex-1 rounded-lg border py-1.5 hover:bg-muted" onClick={event => { const step = nudgeStep(event); onChange(transformExtra(kind, item, dx * step, dy * step, "move", ratio)); }}>{label}</button>)}</div>
    <p className="text-[10px] text-muted-foreground">Arrow keys move the focused item by 0.5%. Shift: 2%. Alt: 0.1%. Alignment uses its unrotated box.</p>
  </fieldset>;
}
