import { MAX_MEDIA_CROP, MEDIA_CROP_EDGES, type MediaCrop } from "@/lib/portfolia/media-crop";

export function MediaCropControls({ crop, onChange }: { crop?: MediaCrop; onChange: (value: MediaCrop | undefined) => void }) {
  return <fieldset className="space-y-2 rounded-lg border p-2 text-xs">
    <legend className="px-1 font-medium">Crop media edges</legend>
    <div className="grid grid-cols-2 gap-2">
      {MEDIA_CROP_EDGES.map(edge => <label key={edge} className="capitalize">{edge} %
        <input type="number" className="mt-1 w-full rounded border bg-background p-1" min={0} max={MAX_MEDIA_CROP * 100} step={.1}
          value={Number(((crop?.[edge] ?? 0) * 100).toFixed(2))}
          onChange={e => onChange({ ...crop, [edge]: Math.min(MAX_MEDIA_CROP, Math.max(0, Number(e.target.value) / 100)) })} />
      </label>)}
    </div>
    <button type="button" className="underline" onClick={() => onChange(undefined)}>Reset crop</button>
  </fieldset>;
}
