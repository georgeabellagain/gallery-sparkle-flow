import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { useBlob, useObjectUrl } from "./Chrome";
import { noteInk } from "@/lib/portfolia/foldout-paint";
import { videoEmbedUrl, type PageHotspot } from "@/lib/portfolia/page-extras";

/** What a hotspot looks like on the page: a pulsing dot, a labelled tag or a call-to-action button. */
export function HotspotFace({ hotspot }: { hotspot: Pick<PageHotspot, "style" | "colour" | "label" | "action"> }) {
  const ink = noteInk(hotspot.colour);
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

/** A hotspot placed on a page (positioned as fractions of the page): press it to open its card or follow its link. */
export function PageHotspotMark({ hotspot }: { hotspot: PageHotspot }) {
  const [open, setOpen] = useState(false);
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
