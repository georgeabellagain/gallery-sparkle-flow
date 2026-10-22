import { useRef, useState } from "react";
import { ExternalLink, Film, Plus, Search, StickyNote, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScrapbookPanel } from "./FoldoutSettings";
import type { ScrapbookSelection } from "./live-scrapbook-context";
import { deleteBlob, putBlob, uid } from "@/lib/portfolia/assets";
import { MAX_FOLDOUTS, MAX_NOTE_ROTATION, newFoldout, noteRotation, readableFoldouts, rotateFoldout, type Foldout } from "@/lib/portfolia/foldouts";
import { LINK_SIZE, MAX_LINKS, MAX_TAGS, MAX_VIDEOS, SPOTLIGHT_CAPTION_LIMIT, SPOTLIGHT_LIMITS, SPOTLIGHT_SIZE, TAG_COLOURS, VIDEO_MAX_MB, VIDEO_WIDTH, hostOf, normaliseUrl, placeVideo, readablePageLinks, readablePageSpotlights, readablePageTags, readablePageVideos, type PageLink, type PageSpotlight, type PageTag, type PageVideo } from "@/lib/portfolia/page-extras";
import { readVideo, videoFileProblem, videoMime } from "@/lib/portfolia/page-video-file";
import { gifFileProblem, gifToVideo, isGif } from "@/lib/portfolia/gif-to-video";
import { addPortfolioExtra, deleteUnusedPortfolioAsset, isPaid, patchPortfolioExtra, removePortfolioExtra, useDoc, type Portfolio } from "@/lib/portfolia/store";

type Shown = { page: number; half?: "left" | "right" };
/**
 * Notes, tabs and links edited straight on the main editor's page: add them to the page in view, pick one on
 * the page to change its words, colour or angle here, and use the full scrapbook editor for pictures and fonts.
 * Every change goes into the same draft as the scrapbook editor, so Save keeps it as before.
 */
export function ScrapbookQuickPanel({ p, shown, selected, onSelect, onOpen, onError, counts }: {
  p: Portfolio;
  shown: Shown[];
  selected: ScrapbookSelection;
  onSelect: (selection: ScrapbookSelection) => void;
  onOpen: (panel: ScrapbookPanel) => void;
  onError: (message: string | null) => void;
  counts: { notes: number; tabs: number; links: number };
}) {
  const pdf = p.pdf!;
  const [target, setTarget] = useState(0);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const page = shown[Math.min(target, shown.length - 1)] ?? { page: 1 };
  const half = page.half ?? (shown.length > 1 && target === 0 ? "left" : "right");
  const report = (ok: boolean, message: string) => onError(ok ? null : message);
  const add = (kind: "sticky" | "foldout") => {
    const note = newFoldout(uid("note"), page.page, half, kind);
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "foldouts", note, MAX_FOLDOUTS);
    report(ok, `Use up to ${MAX_FOLDOUTS} notes per PDF.`);
    if (ok) onSelect({ kind: "foldouts", id: note.id });
  };
  const addTab = () => {
    const tags = readablePageTags(pdf.tags, pdf.pages);
    const tag: PageTag = { id: uid("tab"), page: page.page, label: `p. ${page.page}`, colour: TAG_COLOURS[tags.length % TAG_COLOURS.length]! };
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "tags", tag, MAX_TAGS);
    report(ok, `Use up to ${MAX_TAGS} tabs.`);
    if (ok) onSelect({ kind: "tags", id: tag.id });
  };
  const addLink = () => {
    const address = normaliseUrl(url);
    if (!address) return setUrlError("Enter a website address, like behance.net/yourname.");
    setUrlError("");
    const link: PageLink = { id: uid("link"), page: page.page, half, url: address, x: .5 - LINK_SIZE.default / 2, y: .4, size: LINK_SIZE.default };
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "links", link, MAX_LINKS);
    report(ok, `Use up to ${MAX_LINKS} links.`);
    if (ok) { setUrl(""); onSelect({ kind: "links", id: link.id }); }
  };
  const doc = useDoc();
  const videoInput = useRef<HTMLInputElement>(null);
  const [videoPhase, setVideoPhase] = useState<string | null>(null);
  const [videoError, setVideoError] = useState("");
  const pageVideos = readablePageVideos(pdf.videos, pdf.pages);
  const sideHasVideo = pageVideos.some(v => v.page === page.page && v.half === half);
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
      onSelect({ kind: "videos", id: video.id });
    } catch (e) {
      void deleteBlob(blobKey).catch(() => {}); void deleteBlob(posterKey).catch(() => {});
      setVideoError(e instanceof Error ? e.message : "The video could not be added.");
    } finally {
      setVideoPhase(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  };
  const spotlights = readablePageSpotlights(pdf.spotlights, pdf.pages);
  const spotlightLimit = isPaid(doc) ? SPOTLIGHT_LIMITS.personal : SPOTLIGHT_LIMITS.free;
  const addSpotlight = () => {
    const size = SPOTLIGHT_SIZE.default;
    const s: PageSpotlight = { id: uid("spot"), page: page.page, half, x: (1 - size) / 2, y: 0.3, width: size, height: size * 0.75 };
    const ok = addPortfolioExtra(p.code, pdf.blobKey, "spotlights", s, spotlightLimit);
    report(ok, isPaid(doc) ? `Use up to ${spotlightLimit} spotlights.` : `Free includes ${spotlightLimit} spotlights. Personal adds up to ${SPOTLIGHT_LIMITS.personal}.`);
    if (ok) onSelect({ kind: "spotlights", id: s.id });
  };
  const spotlight = selected?.kind === "spotlights" ? spotlights.find(s => s.id === selected.id) : undefined;
  const video = selected?.kind === "videos" ? pageVideos.find(v => v.id === selected.id) : undefined;
  const note = selected?.kind === "foldouts" ? readableFoldouts(pdf.foldouts, pdf.pages).find(f => f.id === selected.id) : undefined;
  const tab = selected?.kind === "tags" ? readablePageTags(pdf.tags, pdf.pages).find(t => t.id === selected.id) : undefined;
  const link = selected?.kind === "links" ? readablePageLinks(pdf.links, pdf.pages).find(l => l.id === selected.id) : undefined;
  const patchNote = (next: Foldout) => report(patchPortfolioExtra(p.code, pdf.blobKey, "foldouts", next.id, next), "That change could not be saved. Check the text length.");
  const remove = () => {
    if (!selected) return;
    const removed = selected.kind === "videos" ? pageVideos.find(v => v.id === selected.id) : undefined;
    const ok = removePortfolioExtra(p.code, pdf.blobKey, selected.kind, selected.id);
    report(ok, "The item could not be removed. Please try again.");
    // A removed video's files are cleared unless the saved version still uses them.
    if (ok && removed) { void deleteUnusedPortfolioAsset(removed.blobKey); void deleteUnusedPortfolioAsset(removed.posterKey); }
    onSelect(null);
  };
  const field = "mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm";
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Add notes, tabs, links and spotlights to the page in view, then drag them on the page. Pull a corner to resize, the round handle to rotate a note. Press Save above to keep your changes.
      </p>
      <section aria-label="Add to this page" className="space-y-2">
        {shown.length > 1 && (
          <div className="flex gap-1" role="radiogroup" aria-label="Page to add to">
            {shown.map((s, i) => (
              <button key={`${s.page}:${s.half ?? ""}`} type="button" role="radio" aria-checked={i === target} onClick={() => setTarget(i)} className="flex-1 rounded-lg border border-border px-2 py-1 text-xs aria-checked:border-foreground aria-checked:bg-muted">
                {i === 0 ? "Left" : "Right"} · page {s.page}
              </button>
            ))}
          </div>
        )}
        <p className="font-medium">Add to page {page.page}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="line" onClick={() => add("sticky")}><StickyNote className="size-4" />Sticky note</Button>
          <Button size="sm" variant="line" onClick={() => add("foldout")}><Plus className="size-4" />Fold-out note</Button>
          <Button size="sm" variant="line" onClick={addTab}><Tag className="size-4" />Page tab</Button>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="font-medium">Website link</p>
          <p className="mt-1 text-xs text-muted-foreground">Puts the site's logo on the page. Readers click or tap it to open the site in a new tab, in every reading style.</p>
          <div className="mt-2 flex gap-2">
            <input aria-label="Website address" inputMode="url" placeholder="behance.net/yourname" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm" />
            <Button size="sm" onClick={addLink}>Add</Button>
          </div>
          {urlError && <p role="alert" className="mt-1 text-xs text-destructive">{urlError}</p>}
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="flex items-center justify-between font-medium">Video or GIF on the page{!isPaid(doc) && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal">Personal</span>}</p>
          <p className="mt-1 text-xs text-muted-foreground">Plays inside the paper as if printed on it. Starts muted; readers tap it for sound. MP4, WebM or animated GIF up to {VIDEO_MAX_MB} MB, one per page. A GIF is turned into a looping video on your device.</p>
          <input ref={videoInput} type="file" accept="video/mp4,video/webm,image/gif,.mp4,.m4v,.webm,.gif" className="sr-only" tabIndex={-1} aria-hidden onChange={e => void addVideo(e.target.files?.[0])} />
          <Button size="sm" variant="line" className="mt-2 w-full" disabled={Boolean(videoPhase) || sideHasVideo} onClick={() => videoInput.current?.click()}>
            <Film className="size-4" />{videoPhase ? `${videoPhase}…` : sideHasVideo ? "This page has a video" : "Choose a video or GIF"}
          </Button>
          {videoError && <p role="alert" className="mt-1 text-xs text-destructive">{videoError}</p>}
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="flex items-center justify-between font-medium">Spotlight<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal tabular-nums">{spotlights.length} of {spotlightLimit}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Mark a detail worth a closer look. Readers see a magnifier there and can open it large and sharp, with your caption.</p>
          <Button size="sm" variant="line" className="mt-2 w-full" disabled={spotlights.length >= spotlightLimit} onClick={addSpotlight}>
            <Search className="size-4" />Add a spotlight
          </Button>
        </div>
      </section>
      {spotlight && (
        <section aria-label="Selected spotlight" className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">Spotlight</p>
            <Button size="xs" variant="quiet" onClick={remove} aria-label="Delete selected spotlight"><Trash2 className="size-4" />Delete</Button>
          </div>
          <label className="block text-xs">Caption (optional)
            <textarea className={field} rows={2} maxLength={SPOTLIGHT_CAPTION_LIMIT} value={spotlight.caption ?? ""} onChange={e => report(patchPortfolioExtra(p.code, pdf.blobKey, "spotlights", spotlight.id, { ...spotlight, caption: e.target.value || undefined }), `Keep the caption to ${SPOTLIGHT_CAPTION_LIMIT} characters.`)} />
          </label>
          <p className="text-xs text-muted-foreground">Drag the box over the detail; pull its corner to fit it. Readers see exactly what's inside the box, drawn sharp from your PDF.</p>
        </section>
      )}
      {video && (
        <section aria-label="Selected video" className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">Video</p>
            <Button size="xs" variant="quiet" onClick={remove} aria-label="Delete selected video"><Trash2 className="size-4" />Delete</Button>
          </div>
          <p className="text-xs text-muted-foreground">{video.name ?? "Video"} · {(video.bytes / 1048576).toFixed(1)} MB · page {video.page}</p>
          <p className="text-xs text-muted-foreground">Drag it on the page; pull the corner to resize. It keeps its shape.{!isPaid(doc) && " Saving a portfolio with videos needs Personal."}</p>
        </section>
      )}
      {(note || tab || link) && (
        <section aria-label="Selected item" className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">{note ? (note.style === "sticky" ? "Sticky note" : "Fold-out note") : tab ? "Page tab" : "Website link"}</p>
            <Button size="xs" variant="quiet" onClick={remove} aria-label="Delete selected item"><Trash2 className="size-4" />Delete</Button>
          </div>
          {note && <>
            <label className="block text-xs">Words on the note
              <textarea className={field} rows={3} maxLength={1200} value={note.outside?.text ?? note.title} onChange={e => patchNote({ ...note, outside: { ...(note.outside ?? { colour: note.colour, text: "" }), text: e.target.value } })} />
            </label>
            {note.style !== "sticky" && <label className="block text-xs">Inside the fold-out
              <textarea className={field} rows={3} maxLength={1200} value={note.inside?.text ?? ""} onChange={e => patchNote({ ...note, inside: { ...(note.inside ?? { colour: "#fbf6e9", text: "" }), text: e.target.value } })} />
            </label>}
            <label className="flex items-center justify-between gap-3 text-xs">Paper colour
              <input type="color" aria-label="Note paper colour" className="h-8 w-10 cursor-pointer rounded border border-border" value={note.outside?.colour ?? note.colour} onChange={e => patchNote({ ...note, colour: e.target.value, outside: { ...(note.outside ?? { text: note.title }), colour: e.target.value } })} />
            </label>
            <label className="block text-xs">Angle · {noteRotation(note).toFixed(0)}°
              <input type="range" aria-label="Note angle" min={-MAX_NOTE_ROTATION} max={MAX_NOTE_ROTATION} step={1} value={noteRotation(note)} onChange={e => patchNote(rotateFoldout(note, Number(e.target.value)))} className="mt-1 w-full accent-leaf" />
            </label>
          </>}
          {tab && <>
            <label className="block text-xs">Tab label
              <input className={field} maxLength={24} value={tab.label} onChange={e => report(patchPortfolioExtra(p.code, pdf.blobKey, "tags", tab.id, { ...tab, label: e.target.value }), "Keep tab text to 24 characters.")} />
            </label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tab colour">
              {TAG_COLOURS.map(colour => <button key={colour} type="button" role="radio" aria-checked={tab.colour === colour} aria-label={`Tab colour ${colour}`} className="size-6 rounded-full border border-black/15 aria-checked:ring-2 aria-checked:ring-foreground aria-checked:ring-offset-1" style={{ background: colour }} onClick={() => patchPortfolioExtra(p.code, pdf.blobKey, "tags", tab.id, { ...tab, colour })} />)}
            </div>
            <p className="text-xs text-muted-foreground">Readers press a tab to turn straight to page {tab.page}.</p>
          </>}
          {link && <>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ExternalLink className="size-3.5" aria-hidden />Opens {hostOf(link.url)} in a new tab</p>
            <label className="block text-xs">Caption under the logo (optional)
              <input className={field} maxLength={40} value={link.label ?? ""} onChange={e => report(patchPortfolioExtra(p.code, pdf.blobKey, "links", link.id, { ...link, label: e.target.value || undefined }), "Keep the caption short.")} />
            </label>
          </>}
          <Button size="xs" variant="line" onClick={() => onOpen(note ? "notes" : tab ? "tabs" : "links")}>Pictures, fonts and more…</Button>
        </section>
      )}
      <section aria-label="Everything in this portfolio" className="space-y-2 border-t border-border pt-3">
        {([
          ["notes", "Fold-out & sticky notes", counts.notes],
          ["tabs", "Page tabs", counts.tabs],
          ["links", "Website links", counts.links],
        ] as const).map(([id, name, count]) => (
          <button key={id} type="button" onClick={() => onOpen(id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-2.5 text-left transition-colors hover:bg-muted">
            <span className="text-sm">{name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{count}</span>
          </button>
        ))}
        <p className="text-xs text-muted-foreground">Opens the full scrapbook editor, with pictures, fonts and every page.</p>
      </section>
    </div>
  );
}
