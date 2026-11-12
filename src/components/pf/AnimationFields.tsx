import { useMemo, useRef, useState } from "react";
import { Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LIBRARY_CATEGORIES, LIBRARY_CREDIT, LIBRARY_SIZE, libraryEmoji, libraryUrl, searchLibrary, type LibraryAnimation } from "@/lib/portfolia/animation-library";
import { ANIMATION_MAX_MB, type AnimationPlay, type PageSticker } from "@/lib/portfolia/page-extras";
import { cn } from "@/lib/utils";

const PAGE = 40;
const field = "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm";

/**
 * Finding an animation to add: search the built-in library (about 880 looping pictures), or upload your own. The
 * grid shows each entry as the device's own emoji, so browsing loads nothing; hovering or focusing one shows the real
 * animation, and picking it saves a copy with the portfolio.
 */
export function AnimationPicker({ disabled, busy, onPick, onUpload }: {
  disabled?: boolean;
  /** What is being fetched or saved, shown in place of the hint. */
  busy?: string | null;
  onPick: (entry: LibraryAnimation) => void;
  onUpload: (file: File) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [preview, setPreview] = useState<LibraryAnimation | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchLibrary(query, category, LIBRARY_SIZE), [query, category]);
  const previewUrl = preview ? libraryUrl(preview.code) : null;
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search animations</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" className={cn(field, "pl-8")} placeholder="Search: cat, rocket, rain, party…" value={query}
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} />
        </label>
        <select aria-label="Kind of animation" className={cn(field, "w-auto max-w-[9.5rem]")} value={category ?? ""}
          onChange={(e) => { setCategory(e.target.value === "" ? null : Number(e.target.value)); setShown(PAGE); }}>
          <option value="">Everything</option>
          {LIBRARY_CATEGORIES.map((name, i) => <option key={name} value={i}>{name}</option>)}
        </select>
      </div>
      <div className="flex items-start gap-2">
        {results.length ? (
          <div className="grid min-w-0 flex-1 grid-cols-8 gap-1" role="list" aria-label="Animations">
            {results.slice(0, shown).map((entry) => (
              <button key={entry.code} type="button" role="listitem" disabled={disabled} title={entry.name} aria-label={`Add ${entry.name} animation`}
                onClick={() => onPick(entry)}
                onMouseEnter={() => setPreview(entry)} onFocus={() => setPreview(entry)}
                className="flex aspect-square items-center justify-center rounded-lg border border-border bg-background text-lg leading-none transition-colors hover:border-foreground/40 disabled:opacity-50">
                <span aria-hidden>{libraryEmoji(entry.code)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="flex-1 py-3 text-xs text-muted-foreground">Nothing matches “{query}”. Try a simpler word, or upload your own animation.</p>
        )}
        {/* The real animation, loaded only for the one being looked at. */}
        <div className="flex size-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-[#f4f1e9] p-1" aria-live="polite">
          {previewUrl ? <img key={previewUrl} src={previewUrl} alt={`${preview!.name} animation`} width={56} height={56} className="size-14 object-contain" /> : <span className="px-1 text-center text-[10px] leading-tight text-muted-foreground">Point at one to see it move</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{busy ?? (results.length > shown ? `${shown} of ${results.length} shown` : `${results.length} animation${results.length === 1 ? "" : "s"}`)}</span>
        <span className="flex gap-1.5">
          {results.length > shown && <Button size="xs" variant="quiet" onClick={() => setShown((n) => n + PAGE)}>Show more</Button>}
          <Button size="xs" variant="line" disabled={disabled} onClick={() => input.current?.click()}><Upload className="size-3.5" />Upload your own</Button>
        </span>
      </div>
      <input ref={input} type="file" accept="image/gif,image/webp,image/png,image/apng,.gif,.webp,.png,.apng" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onUpload(file); }} />
      <p className="text-[11px] leading-snug text-muted-foreground">
        Your own: an animated GIF, WebP or PNG up to {ANIMATION_MAX_MB} MB. A see-through background sits best on the page. Library: {LIBRARY_CREDIT}.
      </p>
    </div>
  );
}

const PLAYS: Array<[AnimationPlay, string, string]> = [
  ["loop", "Always", "Loops all the time, and keeps moving while the page turns."],
  ["open", "When the page opens", "Plays once each time a reader arrives at the page, then rests on its last picture."],
  ["tap", "When pressed", "Waits on its first picture. Plays once each time a reader presses it."],
];

/** How one placed animation plays and faces. In the editor it always loops, so its motion can be judged. */
export function AnimationOptions({ sticker, save }: { sticker: PageSticker; save: (next: PageSticker) => void }) {
  const play = sticker.play ?? "loop";
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium">Plays</legend>
        <div className="grid gap-1.5">
          {PLAYS.map(([value, name, hint]) => (
            <label key={value} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 text-xs", play === value ? "border-foreground" : "border-border")}>
              <input type="radio" name={`play-${sticker.id}`} className="mt-0.5" checked={play === value} onChange={() => save({ ...sticker, play: value })} />
              <span><span className="block font-medium">{name}</span><span className="block text-muted-foreground">{hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center justify-between gap-3 text-xs">
        <span>Face the other way<span className="block text-muted-foreground">Mirrors it left to right.</span></span>
        <input type="checkbox" checked={Boolean(sticker.flip)} onChange={(e) => { const { flip: _flip, ...rest } = sticker; save(e.target.checked ? { ...rest, flip: true } : rest); }} />
      </label>
      <label className="block text-xs">
        Name (read aloud by screen readers)
        <input className={cn(field, "mt-1")} maxLength={80} value={sticker.image?.name ?? ""} onChange={(e) => sticker.image && save({ ...sticker, image: { ...sticker.image, name: e.target.value } })} />
      </label>
      <p className="text-xs text-muted-foreground">
        Drag it on the page; pull its corner to resize, up to the full page width. While you edit it loops; readers see the setting above. Readers who ask their device for less motion see it still.
      </p>
      {sticker.image?.credit === "noto" && <p className="text-[11px] text-muted-foreground">{LIBRARY_CREDIT}.</p>}
    </div>
  );
}
