import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Play, X } from "lucide-react";
import { useBlob, useObjectUrl } from "./Chrome";
import { noteInk } from "@/lib/portfolia/foldout-paint";
import { videoEmbedUrl, videoPlayUrl, videoThumbnail, type PageHotspot } from "@/lib/portfolia/page-extras";

/** What a hotspot looks like on the page: a pulsing dot, a labelled tag or a call-to-action button. */
export function HotspotFace({ hotspot }: { hotspot: Pick<PageHotspot, "style" | "colour" | "label" | "action"> & { video?: string } }) {
  const ink = noteInk(hotspot.colour);
  // In the editor: an info icon's round (i), and a video player's still picture with its play button.
  if (hotspot.style === "info") {
    return <span className="flex h-full w-full items-center justify-center rounded-full font-serif font-semibold italic shadow ring-2 ring-white" style={{ background: hotspot.colour, color: ink, fontSize: "62cqw" }}>i</span>;
  }
  if (hotspot.style === "video") {
    const thumb = hotspot.video ? videoThumbnail(hotspot.video) : null;
    return (
      <span className="relative block h-full w-full overflow-hidden rounded-[3px] bg-slate-800">
        {thumb && <img src={thumb} alt="" draggable={false} className="h-full w-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex aspect-square w-[16%] items-center justify-center rounded-full" style={{ background: hotspot.colour }}><Play className="ml-[8%] size-[45%]" style={{ color: ink }} fill="currentColor" /></span>
        </span>
        {!thumb && <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[7cqw] text-white">{hotspot.video ? "Vimeo video" : "Add a video link"}</span>}
      </span>
    );
  }
  if (hotspot.style === "dot") {
    return (
      <span className="pf-hotspot-dot relative block h-full w-full" style={{ "--pf-hotspot": hotspot.colour } as CSSProperties}>
        <span className="absolute inset-[22%] rounded-full shadow-[0_1px_4px_rgb(0_0_0/.35)] ring-2 ring-white" style={{ background: hotspot.colour }} />
      </span>
    );
  }
  // Pills size their words to their own width, so they read the same at any zoom.
  return (
    <span className="flex h-full w-full items-center justify-center gap-[6cqw] overflow-hidden rounded-full px-[7cqw] font-medium shadow-[0_2px_8px_rgb(0_0_0/.25)]"
      style={{ background: hotspot.colour, color: ink, fontSize: "11cqw", containerType: "inline-size" } as CSSProperties}>
      {hotspot.style === "tag" && <span aria-hidden className="pf-hotspot-pip size-[1em] shrink-0 rounded-full bg-current opacity-80" />}
      <span className="truncate">{hotspot.label || (hotspot.action === "link" ? "Visit" : "See more")}</span>
      {hotspot.style === "button" && hotspot.action === "link" && <ExternalLink aria-hidden className="size-[1em] shrink-0" />}
    </span>
  );
}

/** The card a hotspot opens: picture, title, price, words, a video and a button. */
export function HotspotPopup({ hotspot, onClose }: { hotspot: PageHotspot; onClose: () => void }) {
  const image = useObjectUrl(useBlob(hotspot.imageKey));
  const video = hotspot.video ? videoEmbedUrl(hotspot.video) : null;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const external = hotspot.url?.startsWith("http");
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={hotspot.title || hotspot.label || "Details"} className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"><X className="size-4" /></button>
        {video ? (
          <div className="aspect-video w-full bg-black">
            <iframe src={video} title={hotspot.title || "Video"} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        ) : image ? (
          <img src={image} alt="" className="max-h-[50vh] w-full bg-slate-100 object-contain" />
        ) : null}
        <div className="space-y-2 p-5">
          {(hotspot.title || hotspot.price) && (
            <div className="flex items-start justify-between gap-3 pr-6">
              {hotspot.title && <h3 className="text-lg font-semibold leading-snug">{hotspot.title}</h3>}
              {hotspot.price && <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-sm font-medium text-white">{hotspot.price}</span>}
            </div>
          )}
          {hotspot.text && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{hotspot.text}</p>}
          {hotspot.url && (
            <a href={hotspot.url} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-sm transition-opacity hover:opacity-90"
              style={{ background: hotspot.colour, color: noteInk(hotspot.colour) }}>
              {hotspot.buttonLabel || "Find out more"}{external && <ExternalLink className="size-4" aria-hidden />}
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * An info icon: a small round "i" that shows a box of extra words while the pointer rests on it (or it has keyboard
 * focus); a tap pins it open on a touch screen, and a second tap or Escape closes it.
 */
function InfoIcon({ hotspot, style }: { hotspot: PageHotspot; style: CSSProperties }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const open = pinned || hover;
  const below = hotspot.y < 0.3, right = hotspot.x > 0.6;
  const id = `pf-tip-${hotspot.id}`;
  return (
    <span className="pointer-events-auto absolute" style={style} onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }} onPointerLeave={() => setHover(false)}>
      <button type="button" aria-label={hotspot.title ? `About: ${hotspot.title}` : "More information"} aria-describedby={open ? id : undefined} aria-expanded={open}
        onClick={() => setPinned((v) => !v)} onFocus={() => setHover(true)} onBlur={() => { setHover(false); setPinned(false); }} onKeyDown={(e) => { if (e.key === "Escape") { setPinned(false); setHover(false); } }}
        className="flex h-full w-full items-center justify-center rounded-full font-serif font-semibold italic shadow-[0_1px_5px_rgb(0_0_0/.3)] ring-2 ring-white transition-transform hover:scale-110"
        style={{ background: hotspot.colour, color: noteInk(hotspot.colour), fontSize: "62cqw", containerType: "inline-size" } as CSSProperties}>
        i
      </button>
      {open && (hotspot.title || hotspot.text) && (
        <span role="tooltip" id={id}
          className={`absolute z-20 w-max max-w-[min(18rem,70vw)] rounded-xl bg-slate-950/95 px-3 py-2 text-left text-[13px] leading-snug text-white shadow-xl ${below ? "top-full mt-2" : "bottom-full mb-2"} ${right ? "right-0" : "left-0"}`}>
          {hotspot.title && <span className="block font-semibold">{hotspot.title}</span>}
          {hotspot.text && <span className="mt-0.5 block whitespace-pre-line text-white/85">{hotspot.text}</span>}
        </span>
      )}
    </span>
  );
}

/**
 * A YouTube or Vimeo video playing on the page itself. Until pressed it is only a picture with a play button (nothing
 * loads from the video site, and a drag still turns the page); pressed, the player starts. Set to start by itself,
 * it plays muted as soon as its page is open, as browsers allow.
 */
function VideoPlayer({ hotspot, style }: { hotspot: PageHotspot; style: CSSProperties }) {
  const [playing, setPlaying] = useState(Boolean(hotspot.autoplay));
  const thumb = hotspot.video ? videoThumbnail(hotspot.video) : null;
  const src = hotspot.video ? videoPlayUrl(hotspot.video, !playing || Boolean(hotspot.autoplay)) : null;
  const title = hotspot.title || "Video";
  return (
    <span className="pointer-events-auto absolute block overflow-hidden rounded-[3px] bg-black shadow-md" style={style}>
      {playing && src ? (
        <iframe src={src} title={title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <button type="button" aria-label={`Play ${title}`} disabled={!src} onClick={() => setPlaying(true)} className="group relative block h-full w-full">
          {thumb ? <img src={thumb} alt="" draggable={false} className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-gradient-to-br from-slate-700 to-slate-900" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/5">
            <span className="flex aspect-square w-[16%] min-w-8 max-w-16 items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-110" style={{ background: hotspot.colour }}>
              <Play className="ml-[8%] size-[45%]" style={{ color: noteInk(hotspot.colour) }} fill="currentColor" />
            </span>
          </span>
          {!src && <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] text-white">Add a YouTube or Vimeo link</span>}
        </button>
      )}
    </span>
  );
}

/** A hotspot placed on a page (positioned as fractions of the page): press it to open its card or follow its link. */
export function PageHotspotMark({ hotspot }: { hotspot: PageHotspot }) {
  const [open, setOpen] = useState(false);
  if (hotspot.style === "info") return <InfoIcon hotspot={hotspot} style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%`, width: `${hotspot.size * 100}%`, aspectRatio: "1" }} />;
  if (hotspot.style === "video") return <VideoPlayer hotspot={hotspot} style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%`, width: `${hotspot.size * 100}%`, aspectRatio: "16 / 9" }} />;
  const square = hotspot.style === "dot";
  const name = hotspot.label || hotspot.title || (hotspot.action === "link" ? "Link" : "Details");
  const style: CSSProperties = { left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%`, width: `${hotspot.size * 100}%`, aspectRatio: square ? "1" : "3.6", containerType: "inline-size" };
  if (hotspot.action === "link" && hotspot.url) {
    const external = hotspot.url.startsWith("http");
    return (
      <a href={hotspot.url} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} aria-label={name}
        className="pointer-events-auto absolute block transition-transform hover:scale-105" style={style}>
        <HotspotFace hotspot={hotspot} />
      </a>
    );
  }
  return (
    <>
      <button type="button" aria-label={`${name}: open`} aria-haspopup="dialog" onClick={() => setOpen(true)}
        className="pointer-events-auto absolute block transition-transform hover:scale-105" style={style}>
        <HotspotFace hotspot={hotspot} />
      </button>
      {open && <HotspotPopup hotspot={hotspot} onClose={() => setOpen(false)} />}
    </>
  );
}
