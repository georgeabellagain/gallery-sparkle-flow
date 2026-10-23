import { BACKGROUND_SCENES } from "@/lib/portfolia/background-scenes";
import { personalBackground } from "@/lib/portfolia/premium-appearance";
import { BackgroundSceneLayer } from "./BackgroundSceneLayer";

/** Colour-and-motion backgrounds, each shown as a small live preview; moving ones are marked. */
export function BackgroundScenePicker({ selected, onSelect }: { selected?: string; onSelect: (id: string, base: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {BACKGROUND_SCENES.map((scene) => (
        <button
          key={scene.id}
          type="button"
          aria-pressed={selected === scene.id}
          onClick={() => onSelect(scene.id, scene.base)}
          className="group overflow-hidden rounded-xl border border-border text-left transition-shadow hover:shadow-sm aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-1"
        >
          <span className="relative block h-14 overflow-hidden">
            <BackgroundSceneLayer scene={scene} />
            {scene.animated && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/35 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">Moving</span>}
          </span>
          <span className="block px-2 py-1.5 text-xs">
            {scene.label}
            {personalBackground(scene.id) ? <span className="text-muted-foreground"> · Personal</span> : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
