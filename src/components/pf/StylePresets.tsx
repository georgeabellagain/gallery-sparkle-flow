import { DEFAULT_VIEWER, isPaid, patchPortfolioAppearance, useDoc, type Portfolio } from "@/lib/portfolia/store";
import { STYLE_PRESETS, matchingPreset, presetIsPersonal, presetPatch, presetSwatch } from "@/lib/portfolia/style-presets";
import { cn } from "@/lib/utils";

/**
 * Ready-made looks: one press sets the book, paper, light, background and page turn together, as a starting point
 * to adjust from. Undo (or Ctrl+Z) puts the previous look back.
 */
export function StylePresets({ p, onSaveError }: { p: Portfolio; onSaveError: (message: string | null) => void }) {
  const doc = useDoc();
  const viewer = { ...DEFAULT_VIEWER, ...p.viewer };
  const chosen = matchingPreset(viewer);
  return (
    <div className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Start from a look</h3>
      <div className="grid grid-cols-2 gap-2">
        {STYLE_PRESETS.map((preset) => {
          const personal = presetIsPersonal(preset) && !isPaid(doc);
          const dark = ["night"].includes(preset.id);
          return (
            <button key={preset.id} type="button" aria-pressed={chosen === preset.id} title={preset.description}
              onClick={() => onSaveError(patchPortfolioAppearance(p.code, { viewer: presetPatch(preset, viewer) }) ? null : "Couldn’t apply that look.")}
              className="group overflow-hidden rounded-xl border border-border/80 text-left transition-shadow hover:shadow-soft aria-pressed:ring-2 aria-pressed:ring-foreground">
              <span className="relative flex h-14 items-center justify-center" style={{ background: presetSwatch(preset) }}>
                {/* A tiny open book in the preset's style. */}
                <span className={cn("flex h-8 w-14 overflow-hidden shadow-md transition-transform group-hover:-translate-y-0.5", preset.viewer.bookStyle === "hardback" ? "rounded-[3px] ring-2 ring-[#3b3530]" : "rounded-[1px]")}>
                  <span className={cn("flex-1", preset.viewer.finish === "paper_0027" ? "bg-[#efeadf]" : "bg-white")} />
                  <span className="w-px bg-black/15" />
                  <span className={cn("flex-1", preset.viewer.finish === "paper_0027" ? "bg-[#efeadf]" : "bg-white")} />
                </span>
                {personal && <span className={cn("absolute right-1 top-1 rounded-full px-1.5 py-px text-[9px]", dark ? "bg-white/20 text-white" : "bg-white/80 text-foreground")}>Personal</span>}
              </span>
              <span className="block px-2 py-1.5">
                <span className="block text-xs font-medium">{preset.label}</span>
                <span className="line-clamp-2 block text-[10px] leading-snug text-muted-foreground">{preset.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">Then fine-tune anything below. Undo puts your previous look back.</p>
    </div>
  );
}
