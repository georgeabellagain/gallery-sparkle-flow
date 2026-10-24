import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { putBlob, uid } from "@/lib/portfolia/assets";
import { MAX_SLIDES, SLIDE_INTERVAL, type PageSlideshow } from "@/lib/portfolia/page-extras";
import { useBlob, useObjectUrl } from "./Chrome";

const seg = "flex-1 rounded-full px-2 py-1.5 text-xs transition-colors aria-pressed:bg-background aria-pressed:font-medium aria-pressed:shadow-sm";

function Thumb({ imageKey }: { imageKey: string }) {
  const url = useObjectUrl(useBlob(imageKey));
  return url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-muted" />;
}

/** Saves a picture at up to 2000 px on its long side, as WebP. */
async function savePicture(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
    if (!blob) throw new Error();
    const key = uid("slide");
    await putBlob(key, blob);
    return key;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A slideshow's pictures (add several at once, put them in order, remove), timing, change and fit. */
export function SlideshowFields({ slideshow, save }: { slideshow: PageSlideshow; save: (next: PageSlideshow, message?: string) => boolean }) {
  const s = slideshow;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const add = async (files: FileList | null) => {
    const chosen = [...(files ?? [])].filter((f) => f.type.startsWith("image/") && f.size <= 15 * 1048576).slice(0, MAX_SLIDES - s.images.length);
    if (!chosen.length) { if (files?.length) setError(`Choose pictures up to 15 MB (up to ${MAX_SLIDES} in all).`); return; }
    setError("");
    const keys: string[] = [];
    try {
      for (const [i, file] of chosen.entries()) {
        setBusy(`Adding ${i + 1} of ${chosen.length}`);
        keys.push(await savePicture(file));
      }
      if (!save({ ...s, images: [...s.images, ...keys] })) throw new Error();
    } catch {
      setError("Some pictures couldn't be added. Please try again.");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= s.images.length) return;
    const images = [...s.images];
    [images[from], images[to]] = [images[to]!, images[from]!];
    save({ ...s, images });
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        {s.images.map((key, i) => (
          <div key={`${key}:${i}`} className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-border">
            <Thumb imageKey={key} />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{i + 1}</span>
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 p-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button type="button" aria-label={`Move picture ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-0.5 text-white disabled:opacity-30"><ChevronLeft className="size-3.5" /></button>
              <button type="button" aria-label={`Remove picture ${i + 1}`} onClick={() => save({ ...s, images: s.images.filter((_, j) => j !== i) })} className="rounded p-0.5 text-white"><X className="size-3.5" /></button>
              <button type="button" aria-label={`Move picture ${i + 1} later`} disabled={i === s.images.length - 1} onClick={() => move(i, i + 1)} className="rounded p-0.5 text-white disabled:opacity-30"><ChevronRight className="size-3.5" /></button>
            </div>
          </div>
        ))}
        {s.images.length < MAX_SLIDES && (
          <button type="button" disabled={Boolean(busy)} onClick={() => input.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[10px] text-muted-foreground hover:border-foreground/40 hover:text-foreground">
            <ImagePlus className="size-4" />{busy || "Add"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void add(e.target.files)} />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">{s.images.length} of {MAX_SLIDES} pictures. Choose several at once; hover one to reorder or remove it.</p>
      <label className="block space-y-1.5 text-xs">
        <span className="flex justify-between"><span>Each picture shows for</span><span className="tabular-nums text-muted-foreground">{s.interval} s</span></span>
        <input type="range" className="w-full" min={SLIDE_INTERVAL.min} max={SLIDE_INTERVAL.max} step={1} value={s.interval} onChange={(e) => save({ ...s, interval: Number(e.target.value) })} />
      </label>
      <div className="flex gap-1 rounded-full bg-muted p-0.5" role="group" aria-label="How pictures change">
        <button type="button" aria-pressed={s.transition === "fade"} className={seg} onClick={() => save({ ...s, transition: "fade" })}>Fade</button>
        <button type="button" aria-pressed={s.transition === "slide"} className={seg} onClick={() => save({ ...s, transition: "slide" })}>Slide</button>
      </div>
      <div className="flex gap-1 rounded-full bg-muted p-0.5" role="group" aria-label="How pictures fit">
        <button type="button" aria-pressed={s.fit === "cover"} className={seg} onClick={() => save({ ...s, fit: "cover" })}>Fill the box</button>
        <button type="button" aria-pressed={s.fit === "contain"} className={seg} onClick={() => save({ ...s, fit: "contain" })}>Show whole</button>
      </div>
      {!s.images.length && <Button size="xs" className="w-full" onClick={() => input.current?.click()}><ImagePlus className="size-3.5" />Choose pictures</Button>}
    </div>
  );
}
