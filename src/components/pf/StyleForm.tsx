import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ViewerSettings } from "@/lib/portfolia/store";

interface StyleFormSettings extends ViewerSettings {
  brightness?: number;
  hdri?: string;
  hdriRotation?: number;
  backgroundImage?: string;
}

export function StyleForm({ value, onChange, disabled }: {
  value: StyleFormSettings;
  onChange: (settings: StyleFormSettings) => void;
  disabled?: boolean;
}) {
  const [saving, setSaving] = useState(false);

  const update = useCallback((patch: Partial<StyleFormSettings>) => {
    onChange({ ...value, ...patch });
  }, [value, onChange]);

  const HDRI_OPTIONS = [
    { id: "studio-soft", label: "Studio soft", thumbnail: "/studio/hdri/studio-soft.jpg" },
    { id: "studio-bright", label: "Studio bright", thumbnail: "/studio/hdri/studio-bright.jpg" },
    { id: "outdoor-noon", label: "Outdoor noon", thumbnail: "/studio/hdri/outdoor-noon.jpg" },
    { id: "outdoor-golden", label: "Golden hour", thumbnail: "/studio/hdri/outdoor-golden.jpg" },
  ];

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        update({ backgroundImage: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <fieldset disabled={disabled} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Paper Material</label>
          <select
            value={value.finish || "satin"}
            onChange={(e) => update({ finish: e.target.value as ViewerSettings["finish"] })}
            className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
          >
            <option value="satin">Satin - Soft gloss</option>
            <option value="textured">Textured - Rich detail</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Satin offers a refined, smooth finish. Textured provides tactile depth and dimension.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Brightness</label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round((value.brightness || 0.65) * 100)}
              onChange={(e) => update({ brightness: Number(e.target.value) / 100 })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Dark</span>
              <span className="font-mono">{Math.round((value.brightness || 0.65) * 100)}%</span>
              <span>Bright</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Adjust overall lighting brightness. Higher values create brighter, more vivid pages.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">HDRI Lighting</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {HDRI_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => update({ hdri: option.id })}
                className={cn(
                  "relative group overflow-hidden rounded-lg border-2 transition-all",
                  (value.hdri || "studio-soft") === option.id
                    ? "border-primary ring-2 ring-primary"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                <img
                  src={option.thumbnail}
                  alt={option.label}
                  className="w-full h-24 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.background = "#ccc";
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Select different HDRI environments for natural scenic shadows and lighting on pages.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">HDRI Rotation</label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="360"
              step="15"
              value={value.hdriRotation || 0}
              onChange={(e) => update({ hdriRotation: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0°</span>
              <span className="font-mono">{value.hdriRotation || 0}°</span>
              <span>360°</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Rotate the HDRI to adjust where shadows and highlights fall on the pages.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Background Image</label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundImageUpload}
              className="flex-1 px-3 py-2 border rounded-lg bg-background text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
            />
          </div>
          {value.backgroundImage && (
            <div className="mt-2 relative w-full h-24 border rounded-lg overflow-hidden">
              <img src={value.backgroundImage} alt="Background" className="w-full h-full object-cover" />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Upload a custom background image to appear behind the flipbook pages.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Mode</label>
          <div className="flex gap-2">
            {[
              { id: "single", label: "Single page" },
              { id: "ready", label: "Two-page spread" },
            ] as const).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => update({ spreads: mode.id })}
                className={cn(
                  "flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors",
                  value.spreads === mode.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </fieldset>
    </form>
  );
}
