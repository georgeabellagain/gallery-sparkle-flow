import { personalHdri } from "@/lib/portfolia/premium-appearance";
import { HDRI_PRESETS, MAX_STUDIO_BRIGHTNESS } from "@/lib/portfolia/lighting";
import { PAPER_STYLES, paperFinish } from "@/lib/portfolia/surface";
import type { ViewerSettings } from "@/lib/portfolia/store";
import { Square, Layers, Origami, Newspaper } from "lucide-react";
import { ChoiceTile } from "./ChoiceTile";
import { NumberSlider } from "./NumberSlider";
type Props = {
  viewer: Partial<ViewerSettings>;
  setViewer: (patch: Partial<ViewerSettings>) => unknown;
};
export function StudioLightingSettings({
  viewer,
  setViewer,
  photo = false,
  heading = true,
}: {
  viewer: Partial<ViewerSettings>;
  setViewer: Props["setViewer"];
  photo?: boolean;
  /** False when a panel section already titles it. */
  heading?: boolean;
}) {
  const studioLighting = viewer.studioLighting ?? "4",
    studioBrightness = viewer.studioBrightness ?? 0.5;
  return (
    <div className="space-y-3">
      {heading && <>
        <p>Studio HDRI</p>
        <p className="text-xs text-muted-foreground">
          {photo
            ? "Choose the light for this photograph."
            : "Preview any light. Free includes 1–4; Personal unlocks all 15 when saving."}
        </p>
      </>}
      {([false, true] as const).map((personal) => (
        <section
          key={String(personal)}
          aria-label={personal ? "Personal HDRIs" : "Free HDRIs"}
          className="space-y-2"
        >
          <h3 className="text-xs font-medium">{personal ? "Personal" : "Free"}</h3>
          <div className="grid grid-cols-3 gap-2">
            {HDRI_PRESETS.filter((light) => personalHdri(light.id) === personal).map((light) => (
              <button
                key={light.id}
                type="button"
                aria-pressed={studioLighting === light.id}
                aria-label={`Lighting ${light.id}: ${light.label}`}
                onClick={() => setViewer({ studioLighting: light.id })}
                className={`relative h-16 overflow-hidden rounded-xl border bg-cover text-white transition-shadow hover:shadow-sm ${studioLighting === light.id ? "ring-2 ring-foreground ring-offset-1 border-foreground" : "border-border"}`}
                style={{ background: light.preview }}
              >
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1 pt-3 text-left text-[10px] font-medium">{light.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="flex justify-end">
        <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setViewer({ studioLighting: "4", studioBrightness: 0.5, studioLightingStrength: 0.75, studioTopLight: 0 })}>
          Reset lighting
        </button>
      </div>
      <NumberSlider label="Studio brightness" value={studioBrightness * 100} max={MAX_STUDIO_BRIGHTNESS * 100} onChange={value => setViewer({ studioBrightness: value / 100 })} />
      <NumberSlider label="Studio lighting diffusion" value={(1 - (viewer.studioLightingStrength ?? 0.75)) * 100} onChange={value => setViewer({ studioLightingStrength: 1 - value / 100 })} />
      <NumberSlider label="Studio white fill light" value={(viewer.studioTopLight ?? 0) * 100} onChange={value => setViewer({ studioTopLight: value / 100 })} />
    </div>
  );
}
export function PaperSettings({ viewer, setViewer, heading = true }: Props & { heading?: boolean }) {
  return (
    <div className="space-y-3">
      {heading && <p className="font-medium">Paper</p>}
      <div className="grid grid-cols-2 gap-2">
        {PAPER_STYLES.map(([id, label]) => (
          <ChoiceTile
            key={id}
            label={label}
            icon={
              id === "matte"
                ? Square
                : id === "satin"
                  ? Layers
                  : id === "paper_0022"
                    ? Origami
                    : Newspaper
            }
            selected={paperFinish(viewer.finish ?? "satin") === id}
            onClick={() => setViewer({ finish: id })}
          />
        ))}
      </div>
    </div>
  );
}
