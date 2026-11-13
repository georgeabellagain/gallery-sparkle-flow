import { MAX_MEDIA_CROP, MEDIA_CROP_EDGES, type MediaCrop } from "@/lib/portfolia/media-crop";

/** Trims a picture, video or animation from each edge: drag a slider, or type an exact amount. */
export function MediaCropControls({ crop, onChange }: { crop?: MediaCrop; onChange: (value: MediaCrop | undefined) => void }) {
  const set = (edge: (typeof MEDIA_CROP_EDGES)[number], percent: number) =>
    onChange({ ...crop, [edge]: Math.min(MAX_MEDIA_CROP, Math.max(0, (Number.isFinite(percent) ? percent : 0) / 100)) });
  const cropped = MEDIA_CROP_EDGES.some((edge) => (crop?.[edge] ?? 0) > 0);
  return <fieldset className="space-y-2 rounded-lg border p-2 text-xs">
    <legend className="px-1 font-medium">Crop</legend>
    {MEDIA_CROP_EDGES.map(edge => {
      const value = Number(((crop?.[edge] ?? 0) * 100).toFixed(1));
      return <div key={edge} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2">
        <label htmlFor={`crop-${edge}`} className="capitalize">{edge}</label>
        <input id={`crop-${edge}`} type="range" min={0} max={MAX_MEDIA_CROP * 100} step={0.5} value={value} onChange={e => set(edge, Number(e.target.value))} />
        <input aria-label={`Crop ${edge} %`} type="number" className="w-full rounded border bg-background p-1" min={0} max={MAX_MEDIA_CROP * 100} step={0.1} value={value} onChange={e => set(edge, Number(e.target.value))} />
      </div>;
    })}
    {cropped && <button type="button" className="underline" onClick={() => onChange(undefined)}>Reset crop</button>}
  </fieldset>;
}
