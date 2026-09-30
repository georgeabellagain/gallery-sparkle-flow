import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight, Download, LayoutGrid, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { describePdfError, loadPdfjs } from "@/lib/portfolia/pdf";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Source = { blob: Blob } | { url: string };

/**
 * Integrated continuous-scroll viewer. Pages render only as they approach the
 * viewport; text stays selectable and web links in the PDF stay clickable.
 */
export function PdfViewer({
  source,
  fileName,
  allowDownload,
  onDownload,
  compact,
  immersive,
  backdrop,
}: {
  source: Source | null;
  fileName: string;
  allowDownload?: boolean;
  onDownload?: () => void;
  compact?: boolean;
  immersive?: boolean;
  backdrop?: string;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [full, setFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controlsVisible, setControlsVisible] = useState(!immersive);
  const [canHover, setCanHover] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>();

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setDoc(null);
    setSizes([]);
    setError(null);
    setProgress(0);
    let objUrl: string | undefined;
    if ("blob" in source) {
      objUrl = URL.createObjectURL(source.blob);
      setDownloadUrl(objUrl);
    } else setDownloadUrl(source.url);
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const task = pdfjs.getDocument(
          "blob" in source ? { data: new Uint8Array(await source.blob.arrayBuffer()) } : { url: source.url },
        );
        task.onProgress = ({ loaded: l, total }: { loaded: number; total: number }) => {
          if (total) setProgress(Math.min(95, Math.round((l / total) * 90)));
        };
        loaded = await task.promise;
        if (cancelled) return void loaded.destroy();
        const s: { w: number; h: number }[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const vp = (await loaded.getPage(i)).getViewport({ scale: 1 });
          s.push({ w: vp.width, h: vp.height });
        }
        if (cancelled) return;
        setSizes(s);
        setDoc(loaded);
        setProgress(100);
      } catch (e) {
        if (!cancelled) setError(describePdfError(e));
      }
    })();
    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
      void loaded?.destroy();
    };
  }, [source]);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  const z = (d: number) => setZoom((v) => Math.min(3, Math.max(0.5, Math.round((v + d) * 100) / 100)));
  const revealControls = (pointerType?: string) => {
    setControlsVisible(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (pointerType !== "touch") controlsTimer.current = setTimeout(() => setControlsVisible(false), 1400);
  };

  useEffect(() => () => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      setCanHover(query.matches);
      if (immersive && query.matches) setControlsVisible(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [immersive]);

  const [mode, setMode] = useState<"scroll" | "paged" | "book">("scroll");
  const [thumbs, setThumbs] = useState(false);
  const [jump, setJump] = useState<{ page: number; t: number } | null>(null);
  const total = doc?.numPages ?? 0;
  const go = (d: number) => setCurrent((c) => Math.min(total, Math.max(1, c + d)));

  const jumpTo = (n: number) => {
    setCurrent(n);
    setJump({ page: n, t: Date.now() });
    if (mode === "scroll") rootRef.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (mode !== "paged" || !total) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") setCurrent((c) => Math.min(total, c + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setCurrent((c) => Math.max(1, c - 1));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [mode, total]);

  return (
    <div ref={rootRef} onPointerMove={(e) => revealControls(e.pointerType)} style={backdrop ? { background: backdrop } : undefined} className={cn("relative bg-foreground", immersive && "min-h-[calc(100vh-5rem)]", full && "overflow-auto")}>
      <div className={cn(
        "sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-1.5 text-xs backdrop-blur transition-opacity duration-200",
        immersive && "-mb-10 opacity-100 focus-within:opacity-100",
        immersive && canHover && !controlsVisible && "pointer-events-none opacity-0",
      )}>
        <div className="flex items-center gap-3">
          <div role="radiogroup" aria-label="Reading mode" className="inline-flex rounded-full border border-border p-0.5">
            {(["scroll", "paged", "book"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-3 py-0.5 transition-colors",
                  mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "scroll" ? "Scroll" : m === "paged" ? "Page by page" : "Flipbook"}
              </button>
            ))}
          </div>
          <span className="hidden tabular-nums text-muted-foreground sm:inline" aria-live="polite">
            {doc ? `Page ${current} of ${doc.numPages}` : error ? "Couldn’t load" : "Loading…"}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {doc && (
            <button
              type="button"
              onClick={() => setThumbs((v) => !v)}
              aria-pressed={thumbs}
              className={cn("mr-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 hover:text-foreground", thumbs ? "bg-muted text-foreground" : "text-muted-foreground")}
            >
              <LayoutGrid className="size-3.5" /> Pages
            </button>
          )}
          <ToolBtn label="Zoom out" onClick={() => z(-0.25)} disabled={zoom <= 0.5}>
            <Minus className="size-3.5" />
          </ToolBtn>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="w-12 py-1 text-center tabular-nums hover:text-foreground"
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolBtn label="Zoom in" onClick={() => z(0.25)} disabled={zoom >= 3}>
            <Plus className="size-3.5" />
          </ToolBtn>
          <span className="mx-1 h-4 w-px bg-border" />
          <ToolBtn label={full ? "Exit full screen" : "Full screen"} onClick={toggleFull}>
            {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </ToolBtn>
          {allowDownload && downloadUrl && (
            <a
              href={downloadUrl}
              download={fileName}
              onClick={onDownload}
              className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 hover:border-foreground"
            >
              <Download className="size-3.5" /> Download PDF
            </a>
          )}
        </div>
      </div>

      {doc && thumbs && (
        <nav aria-label="Pages" className={cn("sticky z-[9] flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur", immersive ? "top-10" : "top-[41px]")}>
          {sizes.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jumpTo(i + 1)}
              aria-label={`Go to page ${i + 1}`}
              aria-current={current === i + 1 ? "page" : undefined}
              className={cn("shrink-0 rounded-md p-0.5 text-xxs text-muted-foreground", current === i + 1 ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border")}
            >
              <div className="pointer-events-none w-16">
                <PdfPage doc={doc} n={i + 1} size={s} zoom={0} onVisible={noop} eager thumb />
              </div>
              <span className="block pt-0.5 tabular-nums">{i + 1}</span>
            </button>
          ))}
        </nav>
      )}

      {error ? (
        <div className="px-6 py-20 text-center text-sm">
          <p className="font-medium text-background">This portfolio couldn’t be displayed</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      ) : !doc ? (
        <div className="mx-auto max-w-xs px-6 py-24 text-center text-xs text-background/70">
          <p>Loading portfolio… {progress}%</p>
          <Progress value={progress} className="mt-3 h-1" />
        </div>
      ) : mode === "book" ? (
        <BookView doc={doc} sizes={sizes} zoom={zoom} jump={jump} onPage={setCurrent} controlsHidden={!!immersive && canHover && !controlsVisible} />
      ) : mode === "paged" ? (
        <div className="overflow-x-auto">
          <div
            className={cn("mx-auto py-6", compact ? "px-3" : "px-3 sm:px-8")}
            style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? (compact ? 900 : 1100) : undefined, minWidth: zoom > 1 ? `${zoom * 100}%` : undefined }}
          >
            {sizes[current - 1] && (
              <PdfPage key={current} doc={doc} n={current} size={sizes[current - 1]!} zoom={zoom} onVisible={noop} eager />
            )}
          </div>
          <div className={cn("flex items-center justify-center gap-3 pb-6 text-xs transition-opacity duration-200", immersive && "opacity-100 focus-within:opacity-100", immersive && canHover && !controlsVisible && "pointer-events-none opacity-0")}>
            <button type="button" onClick={() => go(-1)} disabled={current <= 1} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-1.5 hover:border-foreground disabled:opacity-30">
              <ChevronLeft className="size-3.5" /> Previous
            </button>
            <span className="tabular-nums text-background/70">{current} / {doc.numPages}</span>
            <button type="button" onClick={() => go(1)} disabled={current >= doc.numPages} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-1.5 hover:border-foreground disabled:opacity-30">
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
          <div
            className={cn("mx-auto flex flex-col gap-4 py-6", compact ? "px-3" : "px-3 sm:px-8")}
            style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? (compact ? 900 : 1100) : undefined, minWidth: zoom > 1 ? `${zoom * 100}%` : undefined }}
          >
            {sizes.map((s, i) => (
              <PdfPage key={i} doc={doc} n={i + 1} size={s} zoom={zoom} onVisible={setCurrent} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const noop = () => {};

/** Two-page spread flipbook with a page-turn animation (single pages on phones). */
function BookView({
  doc,
  sizes,
  zoom,
  jump,
  onPage,
  controlsHidden,
}: {
  doc: PDFDocumentProxy;
  sizes: { w: number; h: number }[];
  zoom: number;
  jump: { page: number; t: number } | null;
  onPage: (n: number) => void;
  controlsHidden: boolean;
}) {
  const narrow = useIsMobile();
  const spreads = useMemo(() => {
    const n = sizes.length;
    if (narrow) return Array.from({ length: n }, (_, i) => [i + 1]);
    const out: number[][] = [[1]];
    for (let i = 2; i <= n; i += 2) out.push(i + 1 <= n ? [i, i + 1] : [i]);
    return out;
  }, [sizes.length, narrow]);
  const [idx, setIdx] = useState(0);
  const [leaf, setLeaf] = useState<{ dir: 1 | -1; page: number; slot: 0 | 1 } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);
  const safeIdx = Math.min(idx, spreads.length - 1);
  const spread = spreads[safeIdx] ?? [1];

  useEffect(() => onPage(spread[0]!), [spread, onPage]);
  useEffect(() => {
    if (!jump) return;
    const i = spreads.findIndex((s) => s.includes(jump.page));
    if (i >= 0) setIdx(i);
  }, [jump, spreads]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const flip = (d: 1 | -1) => {
    const next = safeIdx + d;
    if (next < 0 || next >= spreads.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const page = d > 0 ? spread[spread.length - 1]! : spread[0]!;
      const slot: 0 | 1 = narrow ? 0 : d > 0 ? 1 : 0;
      setLeaf({ dir: d, page, slot });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setLeaf(null), 650);
    }
    setIdx(next);
  };
  const flipRef = useRef(flip);
  flipRef.current = flip;

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") flipRef.current(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") flipRef.current(-1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  // Desktop: two equal slots; cover sits on the right like a closed book.
  const slots: (number | null)[] = narrow ? [spread[0]!] : spread.length === 2 ? spread : spread[0] === 1 ? [null, 1] : [spread[0]!, null];
  const ref = sizes[0]!;
  const blankSize = { w: ref.w, h: ref.h };
  const atStart = safeIdx === 0;
  const atEnd = safeIdx === spreads.length - 1;
  const label = spread.length === 2 ? `Pages ${spread[0]}–${spread[1]} of ${sizes.length}` : `Page ${spread[0]} of ${sizes.length}`;

  return (
    <div className="overflow-x-auto">
      <div
        className="mx-auto px-3 py-6 sm:px-8"
        style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? 1400 : undefined, minWidth: zoom > 1 ? `${zoom * 100}%` : undefined }}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const x = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (x == null || end == null || Math.abs(end - x) < 50) return;
          flip(end < x ? 1 : -1);
        }}
      >
        <div className="relative flex" style={{ perspective: "2400px" }} aria-live="polite" aria-label={label}>
          {slots.map((n, i) => (
            <div key={`${safeIdx}-${i}`} className="relative flex-1" style={{ aspectRatio: n ? undefined : `${blankSize.w} / ${blankSize.h}` }}>
              {n && <PdfPage doc={doc} n={n} size={sizes[n - 1]!} zoom={zoom} onVisible={noop} eager />}
              {!narrow && n && <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 w-6", i === 0 ? "right-0 bg-gradient-to-l from-foreground/15 to-transparent" : "left-0 bg-gradient-to-r from-foreground/15 to-transparent")} />}
            </div>
          ))}
          {leaf && (
            <div
              aria-hidden
              className={cn("pf-leaf pointer-events-none absolute top-0", leaf.dir > 0 && !narrow ? "pf-leaf-fwd" : narrow ? "pf-leaf-fwd" : "pf-leaf-back")}
              style={{ left: narrow ? 0 : leaf.slot === 1 ? "50%" : 0, width: narrow ? "100%" : "50%" }}
            >
              <PdfPage doc={doc} n={leaf.page} size={sizes[leaf.page - 1]!} zoom={zoom} onVisible={noop} eager thumb />
            </div>
          )}
          {!atEnd && (
            <button type="button" onClick={() => flip(1)} aria-label="Turn to next page" title="Next page" className="group absolute bottom-0 right-0 size-14 overflow-hidden">
              <span className="absolute bottom-0 right-0 size-7 origin-bottom-right bg-gradient-to-tl from-background from-50% to-foreground/25 to-50% shadow-md transition-all duration-200 group-hover:size-12 group-focus-visible:size-12" />
            </button>
          )}
          {!atStart && (
            <button type="button" onClick={() => flip(-1)} aria-label="Turn to previous page" title="Previous page" className="group absolute bottom-0 left-0 size-14 overflow-hidden">
              <span className="absolute bottom-0 left-0 size-7 bg-gradient-to-tr from-background from-50% to-foreground/25 to-50% shadow-md transition-all duration-200 group-hover:size-12 group-focus-visible:size-12" />
            </button>
          )}
        </div>
      </div>
      <div className={cn("flex items-center justify-center gap-3 pb-6 text-xs transition-opacity duration-200", controlsHidden && "pointer-events-none opacity-0")}>
        <button type="button" onClick={() => flip(-1)} disabled={atStart} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-1.5 hover:border-foreground disabled:opacity-30">
          <ChevronLeft className="size-3.5" /> Previous
        </button>
        <span className="tabular-nums text-background/70">{label}</span>
        <button type="button" onClick={() => flip(1)} disabled={atEnd} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-1.5 hover:border-foreground disabled:opacity-30">
          Next <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function ToolBtn(props: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      className="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
    >
      {props.children}
    </button>
  );
}

function PdfPage({
  doc,
  n,
  size,
  zoom,
  onVisible,
  eager,
  thumb,
}: {
  thumb?: boolean;
  doc: PDFDocumentProxy;
  n: number;
  size: { w: number; h: number };
  zoom: number;
  onVisible: (n: number) => void;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager || n <= 2);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current!;
    const load = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { rootMargin: "800px 0px" });
    const vis = new IntersectionObserver(([e]) => e?.isIntersecting && onVisible(n), { threshold: 0.5 });
    load.observe(el);
    vis.observe(el);
    return () => {
      load.disconnect();
      vis.disconnect();
    };
  }, [n, onVisible]);

  useEffect(() => {
    if (!near) return;
    const el = ref.current!;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const page = await doc.getPage(n);
        const cssW = el.clientWidth;
        const scale = cssW / size.w;
        const vp = page.getViewport({ scale });
        const dpr = thumb ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.setAttribute("aria-hidden", "true");
        const ctx = canvas.getContext("2d")!;
        const rt = page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined } as Parameters<typeof page.render>[0]);
        task = rt;
        await rt.promise;
        if (cancelled) return;

        if (thumb) {
          el.replaceChildren(canvas);
          return;
        }
        const text = document.createElement("div");
        text.className = "textLayer";
        const tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: vp });
        await tl.render();

        const links = document.createElement("div");
        links.className = "absolute inset-0";
        for (const a of await page.getAnnotations()) {
          if (a.subtype !== "Link" || !a.url) continue;
          const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
          const link = document.createElement("a");
          link.href = a.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.title = a.url;
          link.className = "absolute hover:bg-foreground/5 focus-visible:outline-2";
          Object.assign(link.style, {
            left: `${Math.min(x1, x2)}px`,
            top: `${Math.min(y1, y2)}px`,
            width: `${Math.abs(x2 - x1)}px`,
            height: `${Math.abs(y2 - y1)}px`,
          });
          links.append(link);
        }
        if (cancelled) return;
        el.replaceChildren(canvas, text, links);
        el.style.setProperty("--scale-factor", String(scale));
        el.style.setProperty("--total-scale-factor", String(scale));
      } catch (e) {
        if (!cancelled && (e as { name?: string })?.name !== "RenderingCancelledException") setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, doc, n, size.w, zoom]);

  return (
    <div
      ref={ref}
      role={thumb ? undefined : "group"}
      aria-label={thumb ? undefined : `Page ${n}`}
      data-page={thumb ? undefined : n}
      className="relative w-full overflow-hidden bg-background"
      style={{ aspectRatio: `${size.w} / ${size.h}` }}
    >
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Page {n} couldn’t be rendered.
        </p>
      )}
    </div>
  );
}
