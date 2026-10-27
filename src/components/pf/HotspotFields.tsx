import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { putBlob, uid } from "@/lib/portfolia/assets";
import { HOTSPOT_LIMITS, HOTSPOT_SIZE, HOTSPOT_STYLES, TAG_COLOURS, hotspotHref, placeHotspot, videoEmbedUrl, type PageHotspot } from "@/lib/portfolia/page-extras";
import { cn } from "@/lib/utils";
import { useBlob, useObjectUrl } from "./Chrome";

const field = "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm";
const seg = "flex-1 rounded-full px-2 py-1.5 text-xs transition-colors aria-pressed:bg-background aria-pressed:font-medium aria-pressed:shadow-sm";

/** An address typed freely and checked when you leave the box (a half-typed address is never saved or refused). */
function AddressField({ label, value, placeholder, check, onSave }: { label: string; value?: string; placeholder: string; check: (text: string) => string | null; onSave: (next: string | undefined) => boolean }) {
  const [text, setText] = useState(value ?? "");
  const [problem, setProblem] = useState("");
  useEffect(() => setText(value ?? ""), [value]);
  const commit = () => {
    if (!text.trim()) { setProblem(""); onSave(undefined); return; }
    const next = check(text);
    if (!next) { setProblem("That address doesn't look right."); return; }
    setProblem("");
    if (!onSave(next)) setProblem("That couldn't be saved.");
    else setText(next);
  };
  return (
    <label className="block text-xs">{label}
      <input className={field} value={text} placeholder={placeholder} inputMode="url" onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />
      {problem && <span role="alert" className="mt-1 block text-destructive">{problem}</span>}
    </label>
  );
}

/** Everything about one hotspot: how it looks, what it does, and its pop-up card. */
export function HotspotFields({ hotspot, ratio = 1.4, save }: { hotspot: PageHotspot; ratio?: number; save: (next: PageHotspot, message?: string) => boolean }) {
  const h = hotspot;
  const set = (patch: Partial<PageHotspot>, message?: string) => save({ ...h, ...patch }, message);
  const picture = useObjectUrl(useBlob(h.imageKey));
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 15 * 1048576) return setImageError("Choose a picture up to 15 MB.");
    setImageError(""); setBusy(true);
    let url = "";
    try {
      // Kept to 1600 px on its long side: sharp in the pop-up, quick to load.
      url = URL.createObjectURL(file);
      const img = new Image(); img.src = url; await img.decode();
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
      if (!blob) throw new Error();
      const key = uid("hotspot");
      await putBlob(key, blob);
      if (!set({ imageKey: key })) throw new Error();
    } catch {
      setImageError("The picture couldn't be added. Please try again.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const colours = (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Colour">
      {TAG_COLOURS.map((colour) => <button key={colour} type="button" role="radio" aria-checked={h.colour === colour} aria-label={`Colour ${colour}`} className={cn("size-6 rounded-full border border-black/15 aria-checked:ring-2 aria-checked:ring-foreground aria-checked:ring-offset-1")} style={{ background: colour }} onClick={() => set({ colour })} />)}
      <input type="color" aria-label="Any colour" className="h-6 w-8 cursor-pointer rounded border border-border" value={h.colour} onChange={(e) => set({ colour: e.target.value })} />
    </div>
  );
  // An info icon is only its words; a video player is only its video.
  if (h.style === "info") {
    return (
      <div className="space-y-3">
        <label className="block text-xs">Heading (optional)
          <input className={field} maxLength={HOTSPOT_LIMITS.title} value={h.title ?? ""} placeholder="Did you know?" onChange={(e) => set({ title: e.target.value || undefined })} />
        </label>
        <label className="block text-xs">Words shown on hover
          <textarea className={field} rows={3} maxLength={HOTSPOT_LIMITS.text} value={h.text ?? ""} placeholder="Printed on 100% recycled card." onChange={(e) => set({ text: e.target.value || undefined })} />
        </label>
        <p className="text-[11px] text-muted-foreground">On a phone, readers tap the icon to read it.</p>
        <p className="text-xs text-muted-foreground">Icon colour</p>
        {colours}
      </div>
    );
  }
  if (h.style === "video") {
    return (
      <div className="space-y-3">
        <AddressField label="YouTube or Vimeo link" value={h.video} placeholder="youtube.com/watch?v=… or vimeo.com/…" check={(t) => (videoEmbedUrl(t) ? t.trim() : null)} onSave={(video) => set({ video })} />
        <label className="block text-xs">Title (read out to screen readers)
          <input className={field} maxLength={HOTSPOT_LIMITS.title} value={h.title ?? ""} placeholder="Behind the scenes" onChange={(e) => set({ title: e.target.value || undefined })} />
        </label>
        <label className="flex items-start justify-between gap-3 text-xs">
          <span>Start by itself<span className="block text-[11px] text-muted-foreground">Plays muted when its page opens (browsers only allow muted autoplay). Off: readers press play.</span></span>
          <input type="checkbox" className="mt-0.5" checked={Boolean(h.autoplay)} onChange={(e) => set({ autoplay: e.target.checked || undefined })} />
        </label>
        <p className="text-xs text-muted-foreground">Play button colour</p>
        {colours}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Looks like</p>
        <div className="flex gap-1 rounded-full bg-muted p-0.5">
          {HOTSPOT_STYLES.filter((s) => s.id !== "info" && s.id !== "video").map((s) => (
            <button key={s.id} type="button" aria-pressed={h.style === s.id} className={seg}
              onClick={() => save(placeHotspot({ ...h, style: s.id }, h.x, h.y, HOTSPOT_SIZE[s.id], ratio))}>{s.label}</button>
          ))}
        </div>
      </div>
      {h.style !== "dot" && (
        <label className="block text-xs">Words on it
          <input className={field} maxLength={HOTSPOT_LIMITS.label} value={h.label ?? ""} placeholder={h.action === "link" ? "Shop now" : "See details"} onChange={(e) => set({ label: e.target.value || undefined })} />
        </label>
      )}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">When pressed</p>
        <div className="flex gap-1 rounded-full bg-muted p-0.5">
          <button type="button" aria-pressed={h.action === "popup"} className={seg} onClick={() => set({ action: "popup" })}>Opens a pop-up</button>
          <button type="button" aria-pressed={h.action === "link"} className={seg} onClick={() => set({ action: "link" }, "Add the address it goes to first.")} disabled={!h.url}>Goes to a link</button>
        </div>
        {!h.url && <p className="text-[11px] text-muted-foreground">Add an address below to let it go straight to a link.</p>}
      </div>
      {h.action === "popup" && (
        <div className="space-y-3 rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-medium">The pop-up</p>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <label className="block text-xs">Title
              <input className={field} maxLength={HOTSPOT_LIMITS.title} value={h.title ?? ""} placeholder="Linen shirt" onChange={(e) => set({ title: e.target.value || undefined })} />
            </label>
            <label className="block text-xs">Price
              <input className={field} maxLength={HOTSPOT_LIMITS.price} value={h.price ?? ""} placeholder="£45" onChange={(e) => set({ price: e.target.value || undefined })} />
            </label>
          </div>
          <label className="block text-xs">Description
            <textarea className={field} rows={3} maxLength={HOTSPOT_LIMITS.text} value={h.text ?? ""} onChange={(e) => set({ text: e.target.value || undefined })} />
          </label>
          <div className="flex items-center gap-2">
            {picture ? <img src={picture} alt="" className="size-12 rounded-lg object-cover ring-1 ring-border" /> : <span className="flex size-12 items-center justify-center rounded-lg bg-background ring-1 ring-border"><ImagePlus className="size-4 text-muted-foreground" /></span>}
            <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
            <Button size="xs" variant="line" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Adding…" : h.imageKey ? "Change picture" : "Add a picture"}</Button>
            {h.imageKey && <Button size="xs" variant="quiet" aria-label="Remove picture" onClick={() => set({ imageKey: undefined })}><Trash2 className="size-3.5" /></Button>}
          </div>
          {imageError && <p role="alert" className="text-xs text-destructive">{imageError}</p>}
          <AddressField label="Video (YouTube or Vimeo, optional)" value={h.video} placeholder="youtube.com/watch?v=…" check={(t) => (videoEmbedUrl(t) ? t.trim() : null)} onSave={(video) => set({ video })} />
        </div>
      )}
      <AddressField label={h.action === "link" ? "Goes to (website, email or phone)" : "Button in the pop-up goes to (optional)"} value={h.url} placeholder="yourshop.com/item, hello@studio.com or tel:+44…"
        check={hotspotHref} onSave={(url) => set(url ? { url } : { url: undefined, action: "popup" })} />
      {h.action === "popup" && h.url && (
        <label className="block text-xs">Button text
          <input className={field} maxLength={HOTSPOT_LIMITS.button} value={h.buttonLabel ?? ""} placeholder="Find out more" onChange={(e) => set({ buttonLabel: e.target.value || undefined })} />
        </label>
      )}
      {colours}
    </div>
  );
}
