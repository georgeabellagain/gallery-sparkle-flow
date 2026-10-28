import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PageSpotlight } from "@/lib/portfolia/page-extras";
import { fullPdf, isPageImageDocument, pageImageBitmap } from "@/lib/portfolia/page-image-doc";

/** A spotlight and the part of its full PDF page it shows, as fractions of that page. */
export type SpotlightView = { spotlight: PageSpotlight; region: { x: number; y: number; width: number; height: number } };

/** The largest canvas side drawn, which every phone can hold. */
const MAX_SIDE = 4096;

/**
 * The marked detail on a page. A small magnifier always shows there, so readers know they can look closer;
 * the whole box opens it. Pointer and touch events stop here, so opening it never turns the page.
 */
export function SpotlightTarget({ spotlight, onOpen }: { spotlight: PageSpotlight; onOpen: () => void }) {
  const label = spotlight.caption?.trim() ? `Look closer: ${spotlight.caption.trim()}` : "Look closer at this detail";
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-spotlight
      className="group pointer-events-auto absolute cursor-zoom-in touch-manipulation rounded-[3px] outline-none transition-shadow hover:ring-2 hover:ring-white/70 hover:shadow-[0_0_0_9999px_rgba(0,0,0,.12)] focus-visible:ring-2 focus-visible:ring-white"
      style={{ left: `${spotlight.x * 100}%`, top: `${spotlight.y * 100}%`, width: `${spotlight.width * 100}%`, height: `${spotlight.height * 100}%` }}
      onPointerDown={stop}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {!spotlight.hideIcon && <span aria-hidden style={{ left: spotlight.iconX === undefined ? "calc(100% - 14px)" : String(spotlight.iconX * 100) + "%", top: spotlight.iconY === undefined ? "14px" : String(spotlight.iconY * 100) + "%", transform: "translate(-50%, -50%) scale(" + (spotlight.iconScale ?? 1) + ")" }} className="absolute flex size-5 items-center justify-center rounded-full bg-slate-950/70 text-white shadow ring-1 ring-white/40 backdrop-blur-sm transition-transform duration-150 group-hover:scale-110">
        <Search className="size-2.5" />
      </span>}
    </button>
  );
}

/**
 * Draws a region of a PDF page into `canvas` at `pixels` wide. Page pictures draw first when the reader opened
 * on them, then the PDF itself replaces them, sharp at any size. Resolves once the sharpest drawing is done.
 */
async function drawRegion(doc: PDFDocumentProxy, page: number, region: SpotlightView["region"], pixels: number, canvas: HTMLCanvasElement, stopped: () => boolean) {
  const first = await doc.getPage(page);
  const base = first.getViewport({ scale: 1 });
  const regionW = base.width * region.width, regionH = base.height * region.height;
  const scale = Math.min(pixels / regionW, MAX_SIDE / regionW, MAX_SIDE / regionH);
  const w = Math.max(1, Math.round(regionW * scale)), h = Math.max(1, Math.round(regionH * scale));
  const paint = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    if (stopped()) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    draw(ctx);
  };
  let pdf: PDFDocumentProxy | null = doc;
  if (isPageImageDocument(doc)) {
    const pageW = Math.min(MAX_SIDE, Math.round(base.width * scale)), pageH = Math.round((pageW * base.height) / base.width);
    const bitmap = await pageImageBitmap(doc, page, pageW, pageH)?.catch(() => null);
    if (bitmap) {
      paint((ctx) => {
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, region.x * pageW, region.y * pageH, region.width * pageW, region.height * pageH, 0, 0, w, h);
      });
      bitmap.close();
    }
    pdf = await (fullPdf(doc) ?? Promise.resolve(null));
  }
  if (!pdf || stopped()) return;
  const sharp = await pdf.getPage(page);
  const viewport = sharp.getViewport({ scale });
  // Drawn off screen and swapped in whole, so the quick picture never flashes white.
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  await sharp.render({ canvasContext: ctx, viewport, background: "#ffffff", transform: [1, 0, 0, 1, -viewport.width * region.x, -viewport.height * region.y] }).promise;
  paint((c) => c.drawImage(out, 0, 0));
}

/**
 * A spotlight opened large. It is drawn from the PDF at the size of the screen, so fine print and texture stay
 * sharp. Arrow keys move between spotlights, Escape or the backdrop closes it, and focus stays inside while open.
 */
export function SpotlightLightbox({ doc, views, index, onIndex, onClose }: {
  doc: PDFDocumentProxy;
  views: SpotlightView[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const view = views[index]!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [shape, setShape] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const zoomArea = useRef<HTMLDivElement>(null);
  useEffect(() => { setZoom(1); setOrigin({ x: 50, y: 50 }); }, [view]);
  useEffect(() => {
    const el = zoomArea.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const box = el.getBoundingClientRect();
      setOrigin({ x: Math.max(0, Math.min(100, (e.clientX - box.left) / box.width * 100)), y: Math.max(0, Math.min(100, (e.clientY - box.top) / box.height * 100)) });
      setZoom(z => Math.max(1, Math.min(4, z * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.002)))));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const many = views.length > 1;
  const go = (step: number) => onIndex((index + step + views.length) % views.length);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => before?.focus?.();
  }, []);

  useEffect(() => {
    let stopped = false;
    setState("loading");
    const el = canvas.current!;
    void (async () => {
      const page = await doc.getPage(view.spotlight.page);
      const base = page.getViewport({ scale: 1 });
      const aspect = (base.width * view.region.width) / (base.height * view.region.height);
      if (stopped) return;
      setShape(aspect);
      // As wide as the box will be on screen, at the screen's own pixel density (doubled for a closer look on zoom).
      const boxW = Math.min(window.innerWidth * 0.92, window.innerHeight * 0.78 * aspect);
      await drawRegion(doc, view.spotlight.page, view.region, boxW * Math.min(3, (window.devicePixelRatio || 1) * 1.5), el, () => stopped);
      if (!stopped) setState("ready");
    })().catch(() => { if (!stopped) setState("failed"); });
    return () => { stopped = true; };
  }, [doc, view]);

  useEffect(() => {
    // Captured on the window first, so the book underneath never turns or zooms with these keys.
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (many && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); e.stopPropagation(); go(e.key === "ArrowRight" ? 1 : -1); return; }
      if (e.key === "Tab" && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        const firstItem = items[0], lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstItem) { e.preventDefault(); lastItem?.focus(); }
        else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); firstItem?.focus(); }
        e.stopPropagation();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "PageUp", "PageDown", "Home", "End", "+", "-", "="].includes(e.key)) e.stopPropagation();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });

  const caption = view.spotlight.caption?.trim();
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  // Full screen shows only its own element, so the lightbox goes inside it then.
  const target = (document.fullscreenElement as HTMLElement | null) ?? document.body;
  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={caption ? `Spotlight: ${caption}` : "Spotlight"}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/88 p-4 text-white backdrop-blur-sm animate-in fade-in-0 duration-200"
      onPointerDown={stop}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
      onWheel={stop}
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
    >
      <button ref={closeButton} type="button" aria-label="Close spotlight" title="Close (Esc)" onClick={onClose} className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">
        <X className="size-5" />
      </button>
      <figure className="flex max-w-full flex-col items-center gap-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div ref={zoomArea} title="Scroll to zoom · double-click to reset" onDoubleClick={() => setZoom(1)} className="relative overflow-hidden rounded-md bg-white shadow-2xl ring-1 ring-white/20" style={{ aspectRatio: String(shape), width: `min(92vw, calc(78vh * ${shape}))` }}>
          <canvas ref={canvas} aria-hidden className="block h-full w-full" style={{ transform: "scale(" + zoom + ")", transformOrigin: origin.x + "% " + origin.y + "%" }} />
          <button type="button" aria-label="Reset spotlight zoom" onClick={() => setZoom(1)} className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-3 py-1 text-xs text-white">{Math.round(zoom * 100)}% · Reset</button>
          {state !== "ready" && (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-500" aria-live="polite">
              {state === "failed" ? "This detail couldn't be drawn. Please try again." : "Sharpening…"}
            </span>
          )}
        </div>
        {(caption || many) && (
          <figcaption className="flex max-w-[min(92vw,40rem)] flex-col items-center gap-1 text-center">
            {caption && <span className="text-sm leading-relaxed sm:text-base">{caption}</span>}
            {many && <span className="text-xs tabular-nums text-white/60">{index + 1} of {views.length} · page {view.spotlight.page}</span>}
          </figcaption>
        )}
      </figure>
      {many && (
        <>
          <button type="button" aria-label="Previous spotlight" title="Previous (←)" onClick={() => go(-1)} className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white sm:left-4">
            <ChevronLeft className="size-6" />
          </button>
          <button type="button" aria-label="Next spotlight" title="Next (→)" onClick={() => go(1)} className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white sm:right-4">
            <ChevronRight className="size-6" />
          </button>
        </>
      )}
    </div>,
    target,
  );
}
