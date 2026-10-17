import { personalHdri } from "@/lib/portfolia/premium-appearance";
import { HDRI_PRESETS, MAX_STUDIO_BRIGHTNESS } from "@/lib/portfolia/lighting";
import { PAPER_STYLES, paperFinish } from "@/lib/portfolia/surface";
import type { ViewerSettings } from "@/lib/portfolia/store";
import { Square, Layers, Origami, Newspaper } from "lucide-react";
import { ChoiceTile } from "./ChoiceTile";
type Props = {
  viewer: Partial<ViewerSettings>;
  setViewer: (patch: Partial<ViewerSettings>) => unknown;
};
export function StudioLightingSettings({
  viewer,
  setViewer,
  photo = false,
}: {
  viewer: Partial<ViewerSettings>;
  setViewer: Props["setViewer"];
  photo?: boolean;
}) {
  const studioLighting = viewer.studioLighting ?? "4",
    studioBrightness = viewer.studioBrightness ?? 0.5;
  return (
    <div className="space-y-3">
      <p>Studio HDRI</p>
      <p className="text-xs text-muted-foreground">
        {photo
          ? "Choose the light for this photograph."
          : "Preview any light. Free includes 1–4; Personal unlocks all 15 when saving."}
      </p>
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
                aria-label={`Lighting ${light.label}`}
                onClick={() => setViewer({ studioLighting: light.id })}
                className={`h-16 rounded-lg border bg-cover text-white ${studioLighting === light.id ? "ring-2 ring-foreground ring-offset-1 border-foreground" : "border-border"}`}
                style={{ background: light.preview }}
              >
                <span className="rounded bg-black/60 px-2 py-1">{light.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <label className="block space-y-1">
        <span>Brightness · {Math.round(studioBrightness * 100)}%</span>
        <input
          className="w-full accent-leaf"
          type="range"
          aria-label="Studio brightness"
          min="0"
          max={MAX_STUDIO_BRIGHTNESS * 100}
          value={Math.round(studioBrightness * 100)}
          onChange={(e) => setViewer({ studioBrightness: Number(e.target.value) / 100 })}
        />
      </label>
      <label className="block space-y-1">
        <span>Diffusion · {Math.round((1 - (viewer.studioLightingStrength ?? 0.75)) * 100)}%</span>
        <input
          className="w-full accent-leaf"
          type="range"
          aria-label="Studio lighting diffusion"
          min="0"
          max="100"
          value={Math.round((1 - (viewer.studioLightingStrength ?? 0.75)) * 100)}
          onChange={(e) =>
            setViewer({
              studioLightingStrength: 1 - Number(e.target.value) / 100,
            })
          }
        />
      </label>
      <label className="block space-y-1">
        <span>White top light · {Math.round((viewer.studioTopLight ?? 0) * 100)}%</span>
        <input
          className="w-full accent-leaf"
          type="range"
          aria-label="Studio white top light"
          min="0"
          max="100"
          value={Math.round((viewer.studioTopLight ?? 0) * 100)}
          onChange={(e) => setViewer({ studioTopLight: Number(e.target.value) / 100 })}
        />
      </label>
    </div>
  );
}
export function PaperSettings({ viewer, setViewer }: Props) {
  return (
    <div className="space-y-3">
      <p className="font-medium">Paper</p>
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
