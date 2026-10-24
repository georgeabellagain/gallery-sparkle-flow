import { useRef, useState, type ReactNode } from "react";
import { CornerDownRight, ExternalLink, Film, GalleryHorizontal, Link2, MousePointerClick, Plus, Search, Shapes, StickyNote, Tag, Trash2 } from "lucide-react";
import { HotspotFields } from "./HotspotFields";
import { SlideshowFields } from "./SlideshowFields";
import { AnimatedSticker } from "./AnimatedSticker";
import { Button } from "@/components/ui/button";
import type { ScrapbookPanel } from "./FoldoutSettings";
import type { ScrapbookSelection } from "./live-scrapbook-context";
import { deleteBlob, putBlob, uid } from "@/lib/portfolia/assets";
import { MAX_FOLDOUTS, MAX_NOTE_ROTATION, newFoldout, noteRotation, readableFoldouts, rotateFoldout, type Foldout } from "@/lib/portfolia/foldouts";
import { MAX_SLIDESHOWS, SLIDESHOW_SIZE, SLIDE_INTERVAL, placeSlideshow, readablePageSlideshows, type PageSlideshow, HOTSPOT_SIZE, MAX_HOTSPOTS, placeHotspot, readablePageHotspots, type HotspotStyle, type PageHotspot, MAX_STICKERS, STICKERS, STICKER_COLOURS, STICKER_SIZE, placeSticker, readablePageStickers, stickerInfo, type PageSticker, type StickerId, JUMP_SIZE, LINK_SIZE, MAX_JUMPS, MAX_LINKS, MAX_TAGS, MAX_VIDEOS, SPOTLIGHT_CAPTION_LIMIT, SPOTLIGHT_LIMITS, SPOTLIGHT_SIZE, TAG_COLOURS, VIDEO_MAX_MB, VIDEO_WIDTH, hostOf, normaliseUrl, placeJump, placeVideo, readablePageJumps, readablePageLinks, readablePageSpotlights, readablePageTags, readablePageVideos, type PageLink, type PageSpotlight, type PageTag, type PageVideo } from "@/lib/portfolia/page-extras";
import { readVideo, videoFileProblem, videoMime } from "@/lib/portfolia/page-video-file";
import { gifFileProblem, gifToVideo, isGif } from "@/lib/portfolia/gif-to-video";
import { addPortfolioExtra, deleteUnusedPortfolioAsset, isPaid, patchPortfolioExtra, removePortfolioExtra, useDoc, type Portfolio } from "@/lib/portfolia/store";
import { cn } from "@/lib/utils";

type Shown = { page: number; half?: "left" | "right" };
type Kind = NonNullable<ScrapbookSelection>["kind"];

/** One feature: its name, how many there are, an Add button, its items on the open pages and the chosen one's settings. */
function FeatureBox({ icon: Icon, title, count, badge, hint, action, active, children }: {
  icon: typeof StickyNote; title: string; count?: string; badge?: ReactNode; hint: string; action?: ReactNode; active: boolean; children?: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("space-y-2.5 rounded-2xl border p-3 transition-colors", active ? "border-foreground/30 bg-muted/40" : "border-border")}>
      {/* The Add buttons move under the title when there isn't room beside it. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" aria-hidden /></span>
        <div className="min-w-[9rem] flex-1">
          <p className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">{title}{badge}</p>
          {count && <p className="text-[11px] tabular-nums text-muted-foreground">{count}</p>}
        </div>
        {action}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

/**
 * Everything added on top of the pages, edited on the main editor's page: one box per feature. Add an item to the
 * page in view, drag it there, and change it in its box. Every change goes into the draft, so Save keeps it.
 */
export function ScrapbookQuickPanel({ p, shown, selected, onSelect, onOpen, onError, onGoTo, onStickerDrag }: {
  p: Portfolio;
  shown: Shown[];
  selected: ScrapbookSelection;
  onSelect: (selection: ScrapbookSelection) => void;
  onOpen: (panel: ScrapbookPanel) => void;
  onError: (message: string | null) => void;
  /** Shows another page in the book (an item listed from elsewhere was picked). */
  onGoTo?: (page: number) => void;
  /** A sticker is being dragged from the palette (null when it is dropped or let go). */
  onStickerDrag?: (sticker: string | null) => void;
  counts?: { notes: number; tabs: number; links: number };
}) {
  const pdf = p.pdf!;
  const doc = useDoc();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  // New items start on the right-hand page in view; drag them anywhere, across the spine too.
  const page = shown[shown.length - 1] ?? { page: 1 };
  const half = page.half ?? "right";
  const report = (ok: boolean, message: string) => onError(ok ? null : message);
  const select = (kind: Kind, id: string) => onSelect({ kind, id });
  const inView = (item: { page: number }) => shown.some((s) => s.page === item.page);

  const notes = readableFoldouts(pdf.foldouts, pdf.pages);
  const tags = readablePageTags(pdf.tags, pdf.pages);
  const links = readablePageLinks(pdf.links, pdf.pages);
  const jumps = readablePageJumps(pdf.jumps, pdf.pages);
  const spotlights = readablePageSpotlights(pdf.spotlights, pdf.pages);
  const pageVideos = readablePageVideos(pdf.videos, pdf.pages);
  const stickers = readablePageStickers(pdf.stickers, pdf.pages);
  const hotspots = readablePageHotspots(pdf.hotspots, pdf.pages);
  const slideshows = readablePageSlideshows(pdf.slideshows, pdf.pages);
  const spotlightLimit = isPaid(doc) ? SPOTLIGHT_LIMITS.personal : SPOTLIGHT_LIMITS.free;

  const addNote = (kind: "sticky" | "foldout") => {
    const note = newFoldout(uid("note"), page.page, half, kind);
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "foldouts", note, MAX_FOLDOUTS);
    report(ok, `Use up to ${MAX_FOLDOUTS} notes per PDF.`);
    if (ok) select("foldouts", note.id);
  };
  const addTab = () => {
    const tag: PageTag = { id: uid("tab"), page: page.page, label: `p. ${page.page}`, colour: TAG_COLOURS[tags.length % TAG_COLOURS.length]! };
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "tags", tag, MAX_TAGS);
    report(ok, `Use up to ${MAX_TAGS} tabs.`);
    if (ok) select("tags", tag.id);
  };
  const addLink = () => {
    const address = normaliseUrl(url);
    if (!address) return setUrlError("Enter a website address, like behance.net/yourname.");
    setUrlError("");
    const link: PageLink = { id: uid("link"), page: page.page, half, url: address, x: .5 - LINK_SIZE.default / 2, y: .4, size: LINK_SIZE.default };
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "links", link, MAX_LINKS);
    report(ok, `Use up to ${MAX_LINKS} links.`);
    if (ok) { setUrl(""); select("links", link.id); }
  };
  const addJump = () => {
    const onPage = jumps.filter((j) => j.page === page.page && j.half === half);
    // Each new box lands just below the last one on this page, ready for the next line of the contents.
    const below = onPage.reduce((y, j) => Math.max(y, j.y + j.height), 0.25);
    const { width, height } = JUMP_SIZE.default;
    const y = onPage.length ? below + 0.01 : 0.3;
    const j = placeJump({ id: uid("jump"), page: page.page, half, x: (1 - width) / 2, y, width, height, target: Math.min(pdf.pages, page.page + 1) }, (1 - width) / 2, y, width, height);
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "jumps", j, MAX_JUMPS);
    report(ok, `Use up to ${MAX_JUMPS} contents links.`);
    if (ok) select("jumps", j.id);
  };
  const addSpotlight = () => {
    const size = SPOTLIGHT_SIZE.default;
    const s: PageSpotlight = { id: uid("spot"), page: page.page, half, x: (1 - size) / 2, y: 0.3, width: size, height: size * 0.75 };
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "spotlights", s, spotlightLimit);
    report(ok, isPaid(doc) ? `Use up to ${spotlightLimit} spotlights.` : `Free includes ${spotlightLimit} spotlights. Personal adds up to ${SPOTLIGHT_LIMITS.personal}.`);
    if (ok) select("spotlights", s.id);
  };

  const videoInput = useRef<HTMLInputElement>(null);
  const [videoPhase, setVideoPhase] = useState<string | null>(null);
  const [videoError, setVideoError] = useState("");
  const sideHasVideo = pageVideos.some((v) => v.page === page.page && v.half === half);
  const addVideo = async (chosen?: File) => {
    if (!chosen || videoPhase) return;
    const gif = isGif(chosen);
    const problem = gif ? gifFileProblem(chosen) : videoFileProblem(chosen);
    if (problem) return setVideoError(problem);
    if (pageVideos.length >= MAX_VIDEOS) return setVideoError(`Use up to ${MAX_VIDEOS} videos per portfolio.`);
    if (sideHasVideo) return setVideoError("This page already has a video. Remove it first, or add this one to another page.");
    setVideoError("");
    const blobKey = uid("video"), posterKey = `${blobKey}_poster.jpg`;
    try {
      // A GIF becomes a looping silent video first, then joins the page like any video.
      let file = chosen;
      if (gif) {
        setVideoPhase("Turning the GIF into video");
        file = await gifToVideo(chosen, (done) => setVideoPhase(`Turning the GIF into video · ${Math.round(done * 100)}%`));
        const converted = videoFileProblem(file);
        if (converted) throw new Error(converted);
      }
      setVideoPhase("Reading the video");
      const { aspect, poster } = await readVideo(file);
      setVideoPhase("Saving the video");
      await putBlob(blobKey, file);
      await putBlob(posterKey, poster);
      // Placed at a typical page shape; the page in view corrects the height to its own shape straight away.
      const base: PageVideo = { id: uid("vid"), page: page.page, half, x: 0, y: 0, width: VIDEO_WIDTH.default, height: 0.3, aspect, blobKey, posterKey, mime: videoMime(file), bytes: file.size, name: file.name.slice(0, 120), ...(gif ? { silent: true as const } : {}) };
      const video = placeVideo(base, (1 - VIDEO_WIDTH.default) / 2, 0.3, VIDEO_WIDTH.default);
      const ok = addPortfolioExtra(p.code, pdf.blobKey, "videos", video, MAX_VIDEOS);
      if (!ok) { void deleteBlob(blobKey).catch(() => {}); void deleteBlob(posterKey).catch(() => {}); return setVideoError("The video could not be added. Please try again."); }
      select("videos", video.id);
    } catch (e) {
      void deleteBlob(blobKey).catch(() => {}); void deleteBlob(posterKey).catch(() => {});
      setVideoError(e instanceof Error ? e.message : "The video could not be added.");
    } finally {
      setVideoPhase(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  };

  const note = selected?.kind === "foldouts" ? notes.find((f) => f.id === selected.id) : undefined;
  const tab = selected?.kind === "tags" ? tags.find((t) => t.id === selected.id) : undefined;
  const link = selected?.kind === "links" ? links.find((l) => l.id === selected.id) : undefined;
  const jump = selected?.kind === "jumps" ? jumps.find((j) => j.id === selected.id) : undefined;
  const spotlight = selected?.kind === "spotlights" ? spotlights.find((s) => s.id === selected.id) : undefined;
  const video = selected?.kind === "videos" ? pageVideos.find((v) => v.id === selected.id) : undefined;
  const sticker = selected?.kind === "stickers" ? stickers.find((s) => s.id === selected.id) : undefined;
  const hotspot = selected?.kind === "hotspots" ? hotspots.find((h) => h.id === selected.id) : undefined;
  const slideshow = selected?.kind === "slideshows" ? slideshows.find((s) => s.id === selected.id) : undefined;
  const addSlideshow = () => {
    const { width, height } = SLIDESHOW_SIZE.default;
    const s = placeSlideshow({ id: uid("slides"), page: page.page, half, x: 0, y: 0, width, height, images: [], interval: SLIDE_INTERVAL.default, transition: "fade", fit: "cover" }, (1 - width) / 2, 0.3, width, height);
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "slideshows", s, MAX_SLIDESHOWS);
    report(ok, `Use up to ${MAX_SLIDESHOWS} slideshows.`);
    if (ok) select("slideshows", s.id);
  };
  /** A new hotspot in the middle of the page in view, ready to fill in. */
  const addHotspot = (style: HotspotStyle) => {
    const size = style === "dot" ? HOTSPOT_SIZE.dot : style === "tag" ? HOTSPOT_SIZE.tag : HOTSPOT_SIZE.button;
    const step = hotspots.filter((h) => h.page === page.page).length % 4;
    const h = placeHotspot({ id: uid("hotspot"), page: page.page, half, style, x: 0, y: 0, size, colour: style === "button" ? "#1c1c1c" : TAG_COLOURS[0]!, action: "popup", label: style === "dot" ? undefined : style === "tag" ? "See details" : "Find out more" }, 0.5 - size / 2, 0.35 + step * 0.08, size);
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "hotspots", h, MAX_HOTSPOTS);
    report(ok, `Use up to ${MAX_HOTSPOTS} hotspots.`);
    if (ok) select("hotspots", h.id);
  };
  /** A click (rather than a drag) puts the sticker in the middle of the page in view. */
  const addSticker = (id: StickerId) => {
    const size = STICKER_SIZE.default;
    // Each one lands a little apart from the last, so they don't pile up.
    const step = stickers.filter((s) => s.page === page.page).length % 5;
    const s = placeSticker({ id: uid("sticker"), page: page.page, half, sticker: id, colour: STICKER_COLOURS[0]!, x: 0, y: 0, size }, 0.5 - size / 2 + (step - 2) * 0.08, 0.4 + (step % 2) * 0.1, size);
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "stickers", s, MAX_STICKERS);
    report(ok, `Use up to ${MAX_STICKERS} stickers.`);
    if (ok) select("stickers", s.id);
  };
  const patchNote = (next: Foldout) => report(patchPortfolioExtra(p.code, pdf.blobKey, "foldouts", next.id, next), "That change could not be saved. Check the text length.");
  const remove = () => {
    if (!selected) return;
    const removed = selected.kind === "videos" ? pageVideos.find((v) => v.id === selected.id) : undefined;
    const ok = removePortfolioExtra(p.code, pdf.blobKey, selected.kind, selected.id);
    report(ok, "The item could not be removed. Please try again.");
    // A removed video's files are cleared unless the saved version still uses them.
    if (ok && removed) { void deleteUnusedPortfolioAsset(removed.blobKey); void deleteUnusedPortfolioAsset(removed.posterKey); }
    onSelect(null);
  };

  const field = "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm";
  const add = (label: string, onClick: () => void, disabled = false) => (
    <Button size="xs" variant="line" onClick={onClick} disabled={disabled}><Plus className="size-3.5" />{label}</Button>
  );
  /**
   * Every item of one feature, in page order, wherever it is in the book. Those on the open pages are solid; picking
   * one elsewhere turns the book to it.
   */
  const chips = (kind: Kind, items: Array<{ id: string; page: number; label: string }>) => {
    const here = [...items].sort((a, b) => a.page - b.page);
    if (!here.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {here.map((item) => (
          <button key={item.id} type="button" aria-pressed={selected?.kind === kind && selected.id === item.id} title={inView(item) ? undefined : `Go to page ${item.page}`}
            onClick={() => { if (!inView(item)) onGoTo?.(item.page); select(kind, item.id); }}
            className={cn("max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:border-foreground/30 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background", inView(item) ? "border-border bg-background" : "border-dashed border-border bg-transparent text-muted-foreground")}>
            {item.label === `p. ${item.page}` ? item.label : `p. ${item.page} · ${item.label}`}
          </button>
        ))}
      </div>
    );
  };
  const editing = (children: ReactNode, what: string) => (
    <div className="space-y-3 border-t border-border/70 pt-3">
      {children}
      <div className="flex justify-end">
        <Button size="xs" variant="quiet" onClick={remove} aria-label={`Delete selected ${what}`}><Trash2 className="size-3.5" />Delete</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 text-sm">
      <p className="rounded-xl bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        New items appear on page {page.page}. Drag them anywhere, across onto the other page too; pull a corner to
        resize. Every item in the book is listed below; pick one on another page to turn to it. Save keeps your changes.
      </p>

      <FeatureBox icon={StickyNote} title="Notes" count={`${notes.length} of ${MAX_FOLDOUTS}`} hint="A sticky note, or a fold-out readers open to see more." active={Boolean(note)}
        action={<div className="flex gap-1">{add("Sticky", () => addNote("sticky"))}{add("Fold-out", () => addNote("foldout"))}</div>}>
        {chips("foldouts", notes.map((n) => ({ id: n.id, page: n.page, label: (n.outside?.text ?? n.title) || (n.style === "sticky" ? "Sticky note" : "Fold-out") })))}
        {note && editing(<>
          <label className="block text-xs">Words on the note
            <textarea className={field} rows={3} maxLength={1200} value={note.outside?.text ?? note.title} onChange={(e) => patchNote({ ...note, outside: { ...(note.outside ?? { colour: note.colour, text: "" }), text: e.target.value } })} />
          </label>
          {note.style !== "sticky" && <label className="block text-xs">Inside the fold-out
            <textarea className={field} rows={3} maxLength={1200} value={note.inside?.text ?? ""} onChange={(e) => patchNote({ ...note, inside: { ...(note.inside ?? { colour: "#fbf6e9", text: "" }), text: e.target.value } })} />
          </label>}
          <label className="flex items-center justify-between gap-3 text-xs">Paper colour
            <input type="color" aria-label="Note paper colour" className="h-8 w-10 cursor-pointer rounded-lg border border-border" value={note.outside?.colour ?? note.colour} onChange={(e) => patchNote({ ...note, colour: e.target.value, outside: { ...(note.outside ?? { text: note.title }), colour: e.target.value } })} />
          </label>
          <label className="block text-xs">Angle · {noteRotation(note).toFixed(0)}°
            <input type="range" aria-label="Note angle" min={-MAX_NOTE_ROTATION} max={MAX_NOTE_ROTATION} step={1} value={noteRotation(note)} onChange={(e) => patchNote(rotateFoldout(note, Number(e.target.value)))} className="mt-1 w-full" />
          </label>
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => onOpen("notes")}>Add a picture or change the font</button>
        </>, "note")}
      </FeatureBox>

      <FeatureBox icon={MousePointerClick} title="Hotspots & buttons" count={`${hotspots.length} of ${MAX_HOTSPOTS}`} hint="Product tags, pop-ups with a picture, price, video or shop button, and call-to-action buttons to your site, email or phone." active={Boolean(hotspot)}
        action={<div className="flex gap-1">{add("Dot", () => addHotspot("dot"), hotspots.length >= MAX_HOTSPOTS)}{add("Tag", () => addHotspot("tag"), hotspots.length >= MAX_HOTSPOTS)}{add("Button", () => addHotspot("button"), hotspots.length >= MAX_HOTSPOTS)}</div>}>
        {chips("hotspots", hotspots.map((h) => ({ id: h.id, page: h.page, label: h.title || h.label || (h.style === "dot" ? "Dot" : "Hotspot") })))}
        {hotspot && editing(
          <HotspotFields hotspot={hotspot} save={(next: PageHotspot, message?: string) => { const ok = patchPortfolioExtra(p.code, pdf.blobKey, "hotspots", next.id, next); report(ok, message ?? "That change couldn't be saved. Check the words aren't too long."); return ok; }} />,
        "hotspot")}
      </FeatureBox>

      <FeatureBox icon={GalleryHorizontal} title="Slideshows" count={`${slideshows.length} of ${MAX_SLIDESHOWS}`} hint="A box of your pictures on the page that changes by itself. Readers can step through with arrows." active={Boolean(slideshow)}
        action={add("Add", addSlideshow, slideshows.length >= MAX_SLIDESHOWS)}>
        {chips("slideshows", slideshows.map((s) => ({ id: s.id, page: s.page, label: `${s.images.length} picture${s.images.length === 1 ? "" : "s"}` })))}
        {slideshow && editing(
          <SlideshowFields slideshow={slideshow} save={(next: PageSlideshow, message?: string) => { const ok = patchPortfolioExtra(p.code, pdf.blobKey, "slideshows", next.id, next); report(ok, message ?? "That change couldn't be saved."); return ok; }} />,
        "slideshow")}
      </FeatureBox>

      <FeatureBox icon={Shapes} title="Animated stickers" count={`${stickers.length} of ${MAX_STICKERS}`} hint="Small moving arrows, circles and marks. Drag one onto a page, or click it to add it to the page in view." active={Boolean(sticker)}>
        <div className="grid grid-cols-8 gap-1" role="list" aria-label="Stickers">
          {STICKERS.map((s) => (
            <button key={s.id} type="button" role="listitem" draggable title={`${s.label}: drag onto a page, or click to add`} aria-label={`Add ${s.label} sticker`}
              onClick={() => addSticker(s.id)}
              onDragStart={(e) => { e.dataTransfer.setData("application/x-portfolia-sticker", s.id); e.dataTransfer.effectAllowed = "copy"; onStickerDrag?.(s.id); }}
              onDragEnd={() => onStickerDrag?.(null)}
              className="aspect-square cursor-grab rounded-lg border border-border bg-background p-1.5 transition-colors hover:border-foreground/30 active:cursor-grabbing">
              <AnimatedSticker sticker={s.id} colour="#1c1c1c" />
            </button>
          ))}
        </div>
        {chips("stickers", stickers.map((s) => ({ id: s.id, page: s.page, label: stickerInfo(s.sticker)?.label ?? "Sticker" })))}
        {sticker && editing(<>
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Sticker colour">
            {STICKER_COLOURS.map((colour) => <button key={colour} type="button" role="radio" aria-checked={sticker.colour === colour} aria-label={`Sticker colour ${colour}`} className="size-6 rounded-full border border-black/15 aria-checked:ring-2 aria-checked:ring-foreground aria-checked:ring-offset-1" style={{ background: colour }} onClick={() => report(patchPortfolioExtra(p.code, pdf.blobKey, "stickers", sticker.id, { ...sticker, colour } as PageSticker), "The colour could not be saved.")} />)}
            <input type="color" aria-label="Any sticker colour" className="h-6 w-8 cursor-pointer rounded border border-border" value={sticker.colour} onChange={(e) => report(patchPortfolioExtra(p.code, pdf.blobKey, "stickers", sticker.id, { ...sticker, colour: e.target.value } as PageSticker), "The colour could not be saved.")} />
          </div>
          <p className="text-xs text-muted-foreground">Drag it on the page; pull its corner to resize. It moves on its own in the reader.</p>
        </>, "sticker")}
      </FeatureBox>

      <FeatureBox icon={Tag} title="Page tabs" count={`${tags.length} of ${MAX_TAGS}`} hint="Coloured tabs on the edge of the book. Readers press one to turn straight to its page." active={Boolean(tab)}
        action={add("Add", addTab, tags.length >= MAX_TAGS)}>
        {chips("tags", tags.map((t) => ({ id: t.id, page: t.page, label: t.label || "Tab" })))}
        {tab && editing(<>
          <label className="block text-xs">Label
            <input className={field} maxLength={24} value={tab.label} onChange={(e) => report(patchPortfolioExtra(p.code, pdf.blobKey, "tags", tab.id, { ...tab, label: e.target.value }), "Keep tab text to 24 characters.")} />
          </label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tab colour">
            {TAG_COLOURS.map((colour) => <button key={colour} type="button" role="radio" aria-checked={tab.colour === colour} aria-label={`Tab colour ${colour}`} className="size-6 rounded-full border border-black/15 aria-checked:ring-2 aria-checked:ring-foreground aria-checked:ring-offset-1" style={{ background: colour }} onClick={() => patchPortfolioExtra(p.code, pdf.blobKey, "tags", tab.id, { ...tab, colour })} />)}
          </div>
          <p className="text-xs text-muted-foreground">Goes to page {tab.page}. The tab shape is set in Book & turns.</p>
        </>, "tab")}
      </FeatureBox>

      <FeatureBox icon={Link2} title="Website links" count={`${links.length} of ${MAX_LINKS}`} hint="The site's logo on the page. Readers click it to open the site in a new tab." active={Boolean(link)}>
        <div className="flex gap-2">
          <input aria-label="Website address" inputMode="url" placeholder="behance.net/yourname" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" />
          <Button size="xs" onClick={addLink} disabled={links.length >= MAX_LINKS}>Add</Button>
        </div>
        {urlError && <p role="alert" className="text-xs text-destructive">{urlError}</p>}
        {chips("links", links.map((l) => ({ id: l.id, page: l.page, label: hostOf(l.url) })))}
        {link && editing(<>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ExternalLink className="size-3.5" aria-hidden />Opens {hostOf(link.url)} in a new tab</p>
          <label className="block text-xs">Caption under the logo (optional)
            <input className={field} maxLength={40} value={link.label ?? ""} onChange={(e) => report(patchPortfolioExtra(p.code, pdf.blobKey, "links", link.id, { ...link, label: e.target.value || undefined }), "Keep the caption short.")} />
          </label>
        </>, "link")}
      </FeatureBox>

      <FeatureBox icon={CornerDownRight} title="Contents links" count={`${jumps.length} of ${MAX_JUMPS}`} hint="A box over each line of your contents page. Readers click the line to go straight to its page." active={Boolean(jump)}
        action={add("Add", addJump, jumps.length >= MAX_JUMPS)}>
        {chips("jumps", jumps.map((j) => ({ id: j.id, page: j.page, label: `to p. ${j.target}` })))}
        {jump && editing(<>
          <label className="flex items-center justify-between gap-3 text-xs">Goes to page
            <input type="number" min={1} max={pdf.pages} value={jump.target} className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
              onChange={(e) => { const to = Math.round(Number(e.target.value)); if (Number.isInteger(to) && to >= 1 && to <= pdf.pages) report(patchPortfolioExtra(p.code, pdf.blobKey, "jumps", jump.id, { ...jump, target: to }), `Choose a page from 1 to ${pdf.pages}.`); }} />
          </label>
          <p className="text-xs text-muted-foreground">Fit the box over its line. The next one you add appears just below.</p>
        </>, "contents link")}
      </FeatureBox>

      <FeatureBox icon={Search} title="Spotlights" count={`${spotlights.length} of ${spotlightLimit}`} hint="Mark a detail. Readers open it large and sharp, with your caption." active={Boolean(spotlight)}
        action={add("Add", addSpotlight, spotlights.length >= spotlightLimit)}>
        {chips("spotlights", spotlights.map((s) => ({ id: s.id, page: s.page, label: s.caption || "Spotlight" })))}
        {spotlight && editing(<>
          <label className="block text-xs">Caption (optional)
            <textarea className={field} rows={2} maxLength={SPOTLIGHT_CAPTION_LIMIT} value={spotlight.caption ?? ""} onChange={(e) => report(patchPortfolioExtra(p.code, pdf.blobKey, "spotlights", spotlight.id, { ...spotlight, caption: e.target.value || undefined }), `Keep the caption to ${SPOTLIGHT_CAPTION_LIMIT} characters.`)} />
          </label>
        </>, "spotlight")}
      </FeatureBox>

      <FeatureBox icon={Film} title="Video or GIF" count={`${pageVideos.length} of ${MAX_VIDEOS}`} badge={!isPaid(doc) ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal">Personal</span> : undefined}
        hint={`Plays inside the page, muted until tapped. MP4, WebM or GIF up to ${VIDEO_MAX_MB} MB, one per page.`} active={Boolean(video)}
        action={add(videoPhase ? "Adding…" : "Add", () => videoInput.current?.click(), Boolean(videoPhase) || sideHasVideo)}>
        <input ref={videoInput} type="file" accept="video/mp4,video/webm,image/gif,.mp4,.m4v,.webm,.gif" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void addVideo(e.target.files?.[0])} />
        {videoPhase && <p className="text-xs text-muted-foreground">{videoPhase}…</p>}
        {sideHasVideo && !videoPhase && <p className="text-xs text-muted-foreground">Page {page.page} already has a video.</p>}
        {videoError && <p role="alert" className="text-xs text-destructive">{videoError}</p>}
        {chips("videos", pageVideos.map((v) => ({ id: v.id, page: v.page, label: v.name ?? "Video" })))}
        {video && editing(
          <p className="text-xs text-muted-foreground">{video.name ?? "Video"} · {(video.bytes / 1048576).toFixed(1)} MB · page {video.page}{!isPaid(doc) && ". Saving a portfolio with videos needs Personal."}</p>,
        "video")}
      </FeatureBox>
    </div>
  );
}
