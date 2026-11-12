import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimationOptions, AnimationPicker } from "@/components/pf/AnimationFields";
import { libraryUrl, type LibraryAnimation } from "@/lib/portfolia/animation-library";
import { putLocalBlob, uid } from "@/lib/portfolia/assets";
import { animationFileProblem, animationKind } from "@/lib/portfolia/page-animation";
import { ANIMATION_SIZE, MAX_ANIMATIONS, STICKER_SIZE, placeSticker, type PageSticker } from "@/lib/portfolia/page-extras";
import { uploadProductAnimation } from "@/lib/products/client";
import { productAnimationKey, productStickers, type AnimationFileKind, type ProductAnimation } from "@/lib/products/model";
import { cn } from "@/lib/utils";

const KIND: Record<string, AnimationFileKind> = { "image/webp": "webp", "image/gif": "gif", "image/png": "png" };
const field = "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

/**
 * Page animations for a product: pick from the library or upload, then say which page each sits on, where, how big
 * and how it plays. The book beside the panel shows them moving. Placing is by page number and sliders here (the
 * portfolio editor's drag-on-the-page tools belong to its own saving flow).
 */
export function ProductAnimations({ id, animations, pages, sheets, page, ratio = 1.4, onChange, onGoTo, onError }: {
  id: string;
  animations: ProductAnimation[];
  /** Pages in the customer PDF. */
  pages: number;
  /** The PDF's pages are whole spreads, so an animation also needs a side. */
  sheets: boolean;
  /** The customer-PDF page in view, where a new animation lands. */
  page: number;
  ratio?: number;
  onChange: (next: ProductAnimation[]) => void;
  onGoTo?: (page: number) => void;
  onError: (message: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const selected = animations.find((a) => a.id === chosen);
  const patch = (next: ProductAnimation) => onChange(animations.map((a) => (a.id === next.id ? next : a)));
  /** Keeps it on its page, at a size the page allows. */
  const place = (a: ProductAnimation, x: number, y: number, size: number): ProductAnimation => {
    const s = placeSticker({ id: a.id, page: a.page, half: a.half, sticker: "animation", colour: "#1c1c1c", x: a.x, y: a.y, size: a.size }, x, y, size, ratio);
    return { ...a, x: s.x, y: s.y, size: s.size };
  };

  const add = async (blob: Blob, name: string, credit?: "noto") => {
    if (animations.length >= MAX_ANIMATIONS) return onError(`Use up to ${MAX_ANIMATIONS} animations in a product.`);
    const data = await blob.arrayBuffer();
    const mime = animationKind(new Uint8Array(data, 0, Math.min(16, data.byteLength)));
    const problem = animationFileProblem({ size: blob.size, name }, mime);
    if (problem || !mime) return onError(problem ?? "Use an animated GIF, WebP or PNG.");
    const typed = new Blob([data], { type: mime });
    const file = await uploadProductAnimation(id, typed, KIND[mime]!);
    const base: ProductAnimation = { id: uid("anim"), page: Math.min(Math.max(1, page), Math.max(1, pages)), half: "right", x: 0, y: 0, size: ANIMATION_SIZE.default, play: "loop", name: name.slice(0, 80) || undefined, ...(credit ? { credit } : {}), file };
    // The editor's book reads the picture from this browser, under the same name readers will fetch it by.
    await putLocalBlob(productAnimationKey(base), typed);
    const step = animations.filter((a) => a.page === base.page).length % 5;
    const placed = place(base, 0.5 - base.size / 2 + (step - 2) * 0.06, 0.3 + (step % 2) * 0.08, base.size);
    onChange([...animations, placed]);
    setChosen(placed.id);
  };
  const working = async (label: string, job: () => Promise<void>) => {
    setPhase(label);
    try { await job(); } catch (e) { onError(e instanceof Error && e.message ? e.message : "That animation couldn’t be loaded. Check your connection and try again."); } finally { setPhase(null); }
  };
  const pick = (entry: LibraryAnimation) => void working(`Adding ${entry.name}…`, async () => {
    const url = libraryUrl(entry.code);
    if (!url) throw new Error("");
    const response = await fetch(url, { referrerPolicy: "no-referrer", credentials: "omit" });
    if (!response.ok) throw new Error("");
    await add(await response.blob(), entry.name, "noto");
  });
  const upload = (file: File) => void working("Adding your animation…", () => add(file, file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ")));

  const asSticker = (a: ProductAnimation): PageSticker | undefined => productStickers([a], { total: Math.max(pages, a.page) })[0];
  const sticker = selected && asSticker(selected);
  const slider = (label: string, value: number, min: number, max: number, set: (v: number) => void) => (
    <label className="block text-xs">
      <span className="flex justify-between"><span>{label}</span><span className="text-muted-foreground">{Math.round(value * 100)}%</span></span>
      <input type="range" className="mt-1 w-full" min={Math.round(min * 100)} max={Math.round(max * 100)} step={1} value={Math.round(value * 100)} onChange={(e) => set(Number(e.target.value) / 100)} />
    </label>
  );
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Moving pictures that sit on your pages with no box round them. Shoppers see the ones on preview pages; customers see them all.</p>
      <AnimationPicker disabled={Boolean(phase) || animations.length >= MAX_ANIMATIONS} busy={phase} onPick={pick} onUpload={upload} />
      {animations.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">On your pages · {animations.length} of {MAX_ANIMATIONS}</h3>
          <div className="flex flex-wrap gap-1.5">
            {[...animations].sort((a, b) => a.page - b.page).map((a) => (
              <button key={a.id} type="button" aria-pressed={a.id === chosen} onClick={() => { setChosen(a.id === chosen ? null : a.id); onGoTo?.(a.page); }}
                className={cn("max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:border-foreground/30", a.id === chosen ? "border-foreground bg-foreground text-background" : "border-border bg-background")}>
                p. {a.page} · {a.name || "Animation"}
              </button>
            ))}
          </div>
        </div>
      )}
      {selected && sticker && (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <div className={cn("grid gap-2", sheets ? "grid-cols-2" : "grid-cols-1")}>
            <label className="block text-xs">
              Page
              <input type="number" className={field} min={1} max={pages} value={selected.page}
                onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= pages) { patch({ ...selected, page: n }); onGoTo?.(n); } }} />
            </label>
            {sheets && (
              <label className="block text-xs">
                Side of the spread
                <select className={field} value={selected.half} onChange={(e) => patch({ ...selected, half: e.target.value as "left" | "right" })}>
                  <option value="left">Left page</option>
                  <option value="right">Right page</option>
                </select>
              </label>
            )}
          </div>
          {slider("Size", selected.size, STICKER_SIZE.min, ANIMATION_SIZE.max, (v) => patch(place(selected, selected.x, selected.y, v)))}
          {slider("From the left", selected.x, 0, Math.max(0, 1 - selected.size), (v) => patch(place(selected, v, selected.y, selected.size)))}
          {slider("From the top", selected.y, 0, Math.max(0, 1 - selected.size / ratio), (v) => patch(place(selected, selected.x, v, selected.size)))}
          <AnimationOptions sticker={sticker} save={(next) => patch({ ...selected, play: next.play, flip: next.flip, name: next.image?.name?.slice(0, 80) || undefined })} />
          <div className="flex justify-end gap-1">
            <Button size="xs" variant="quiet" disabled={animations.length >= MAX_ANIMATIONS} onClick={() => { const copy = place({ ...selected, id: uid("anim") }, selected.x + 0.04, selected.y + 0.04, selected.size); onChange([...animations, copy]); setChosen(copy.id); }}><Copy className="size-3.5" />Duplicate</Button>
            <Button size="xs" variant="quiet" onClick={() => { onChange(animations.filter((a) => a.id !== selected.id)); setChosen(null); }}><Trash2 className="size-3.5" />Delete</Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Save to keep your changes. Switch between Customer edition and Public preview above the book to see what each reader gets.</p>
    </div>
  );
}
