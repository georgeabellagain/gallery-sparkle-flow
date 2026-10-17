import { BACKGROUND_PRESETS } from "@/lib/portfolia/background-presets";
import { personalBackground } from "@/lib/portfolia/premium-appearance";
export function BackgroundPresetPicker({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BACKGROUND_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          aria-pressed={selected === preset.id}
          onClick={() => onSelect(preset.id)}
          className="overflow-hidden rounded border border-border text-left aria-pressed:ring-2 aria-pressed:ring-blue-600"
        >
          <img
            src={preset.url.replace(".webp", "-thumb.webp")}
            alt=""
            loading="lazy"
            className="h-14 w-full object-cover"
          />
          <span className="block p-2">
            {preset.label}
            {personalBackground(preset.id) ? " · Personal" : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
