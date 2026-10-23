import { SHADE_STYLES, readableShadeStyle, type ShadeStyle } from "@/lib/portfolia/shade-style";
import { cn } from "@/lib/utils";

/** A swatch of each style's shade, fading from dark (left) to none, drawn with CSS so it costs nothing. */
const SWATCH: Record<ShadeStyle, string> = {
  standard: "linear-gradient(to right, rgba(28,27,26,.55), rgba(28,27,26,0))",
  blend: "linear-gradient(to right, rgba(28,27,26,.45), rgba(28,27,26,.18) 45%, rgba(28,27,26,0))",
  stipple: "radial-gradient(circle, rgba(28,27,26,.8) 0.75px, transparent 1px) 0 0 / 3px 3px",
  hatch: "repeating-linear-gradient(45deg, rgba(28,27,26,.75) 0 0.8px, transparent 0.8px 3px)",
  crosshatch: "repeating-linear-gradient(45deg, rgba(28,27,26,.7) 0 0.7px, transparent 0.7px 3px), repeating-linear-gradient(-45deg, rgba(28,27,26,.6) 0 0.7px, transparent 0.7px 3px)",
};
const FADE = "linear-gradient(to right, #000 15%, transparent 95%)";

/** How the Simple look draws the shadow behind the book: smooth, blended, stippled, hatched or cross-hatched. */
export function ShadeStylePicker({ value, onChange }: { value: ShadeStyle | undefined; onChange: (style: ShadeStyle) => void }) {
  const current = readableShadeStyle(value);
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Shadow style" className="grid grid-cols-5 gap-1.5">
        {SHADE_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={current === s.id}
            title={s.description}
            onClick={() => onChange(s.id)}
            className={cn("group flex flex-col items-center gap-1 rounded-xl border p-1.5 text-[10px] transition-colors", current === s.id ? "border-foreground bg-muted" : "border-border hover:bg-muted/60")}
          >
            <span aria-hidden className="block h-8 w-full rounded-md bg-white ring-1 ring-black/5" style={{ background: `${SWATCH[s.id]}, #fff`, WebkitMaskImage: s.id === "standard" || s.id === "blend" ? undefined : FADE, maskImage: s.id === "standard" || s.id === "blend" ? undefined : FADE }} />
            <span className="leading-none">{s.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{SHADE_STYLES.find((s) => s.id === current)!.description} Used for the shadow behind the book.</p>
    </div>
  );
}
