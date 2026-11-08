import { HALFTONE_STYLES, SHADE_STYLES, readableShadeStyle, type ShadeStyle } from "@/lib/portfolia/shade-style";
import { cn } from "@/lib/utils";

/** Small vector swatches share the renderer's dot spacing and tonal curve. */
function ShadeSwatch({ style }: { style: ShadeStyle }) {
  const dots = HALFTONE_STYLES.find(s => s.id === style);
  if (dots) {
    const step = 320 / dots.frequency;
    const marks = [];
    for (let y = step / 2; y < 36; y += step) for (let x = step / 2; x < 60; x += step) {
      const tone = Math.max(0, 1 - Math.hypot((x - 30) / 29, (y - 18) / 17));
      marks.push(<circle key={x + ":" + y} cx={x} cy={y} r={step * dots.radius * Math.pow(tone, dots.power)} />);
    }
    return <svg aria-hidden viewBox="0 0 60 36" className="h-9 w-full rounded-md bg-white text-neutral-900" fill="currentColor">{marks}</svg>;
  }
  const sketch = style === "sketch";
  return <span aria-hidden className="block h-9 w-full rounded-md bg-white" style={{ backgroundImage: sketch ? "repeating-linear-gradient(45deg,#333 0 .7px,transparent .7px 4px),repeating-linear-gradient(-45deg,#555 0 .5px,transparent .5px 6px)" : "radial-gradient(ellipse,#333,transparent 70%)", maskImage: sketch ? "radial-gradient(ellipse,#000,transparent 75%)" : undefined }} />;
}

export function ShadeStylePicker({ value, onChange }: { value: ShadeStyle | undefined; onChange: (style: ShadeStyle) => void }) {
  const current = readableShadeStyle(value);
  return <div className="space-y-2">
    <div role="radiogroup" aria-label="Shadow style" className="grid grid-cols-3 gap-1.5">
      {SHADE_STYLES.map(s => <button key={s.id} type="button" role="radio" aria-checked={current === s.id} title={s.description} onClick={() => onChange(s.id)}
        className={cn("group flex flex-col items-center gap-1 rounded-xl border p-1.5 text-[10px] transition-colors", current === s.id ? "border-foreground bg-muted" : "border-border hover:bg-muted/60")}>
        <ShadeSwatch style={s.id} /><span className="leading-none">{s.label}</span>
      </button>)}
    </div>
    <p className="text-xs text-muted-foreground">{SHADE_STYLES.find(s => s.id === current)!.description} Used for the shadow behind the book.</p>
  </div>;
}
