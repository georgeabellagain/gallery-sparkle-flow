import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, LayoutGrid, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { describePdfError, loadPdfjs } from "@/lib/portfolia/pdf";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CurvedPage, type TurnerHandle } from "@/components/pf/CurvedPage";
import { useIsMobile } from "@/hooks/use-mobile";
import { DEFAULT_VIEWER, type ViewerSettings } from "@/lib/portfolia/store";

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
  viewer,
  startPage = 1,
}: {
  source: Source | null;
  fileName: string;
  allowDownload?: boolean;
  onDownload?: () => void;
  compact?: boolean;
  immersive?: boolean;
  backdrop?: string;
  viewer?: ViewerSettings;
  startPage?: number;
}) {
  const view = { ...DEFAULT_VIEWER, ...viewer };
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

  const [mode, setMode] = useState<"scroll" | "paged" | "book">(view.mode);
  const [thumbs, setThumbs] = useState(false);
  const [jump, setJump] = useState<{ page: number; t: number } | null>(null);
  const total = doc?.numPages ?? 0;
  const go = (d: number) => setCurrent((c) => Math.min(total, Math.max(1, c + d)));

  const jumpTo = (n: number) => {
    setCurrent(n);
    setJump({ page: n, t: Date.now() });
    if (mode === "scroll") rootRef.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => setMode(view.mode), [view.mode]);
  useEffect(() => {
    if (!total) return;
    const page = Math.min(total, Math.max(1, startPage));
    setCurrent(page);
    setJump({ page, t: Date.now() });
  }, [startPage, total]);

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
    <div ref={rootRef} onPointerMove={(e) => revealControls(e.pointerType)} style={backdrop ? { background: backdrop } : undefined} className={cn("relative bg-foreground", !backdrop && view.background === "paper" && "bg-background", !backdrop && view.background === "soft" && "bg-muted", immersive && "min-h-[calc(100vh-5rem)]", full && "overflow-auto")}>
      <div className={cn(
        "sticky top-0 z-50 isolate flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-1.5 text-xs backdrop-blur transition-opacity duration-200",
        immersive && "opacity-100 focus-within:opacity-100",
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
        <nav aria-label="Pages" className={cn("sticky z-40 isolate flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur", immersive ? "top-10" : "top-[41px]")}>
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
        <BookView doc={doc} sizes={sizes} zoom={zoom} jump={jump} onPage={setCurrent} controlsHidden={!!immersive && canHover && !controlsVisible} viewer={view} />
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

/** Responsive flipbook: desktop spreads and single-page mobile turns. */
function BookView({
  doc,
  sizes,
  zoom,
  jump,
  onPage,
  controlsHidden,
  viewer,
}: {
  doc: PDFDocumentProxy;
  sizes: { w: number; h: number }[];
  zoom: number;
  jump: { page: number; t: number } | null;
  onPage: (n: number) => void;
  controlsHidden: boolean;
  viewer: ViewerSettings;
}) {
  const narrow = useIsMobile() || viewer.spreads === "ready";
  const spreads = useMemo(() => {
    const n = sizes.length;
    if (narrow) return Array.from({ length: n }, (_, i) => [i + 1]);
    const out: number[][] = [[1]];
    for (let i = 2; i <= n; i += 2) out.push(i + 1 <= n ? [i, i + 1] : [i]);
    return out;
  }, [sizes.length, narrow]);
  const [idx, setIdx] = useState(0);
  // Explicit turn state: set once when a turn starts and once when it ends.
  const [turn, setTurn] = useState<{ dir: 1 | -1; from: number; to: number } | null>(null);
  const turning = useRef(false);
  const turner = useRef<TurnerHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dir: 1 | -1; x: number; w: number; started: boolean; p: number } | null>(null);
  const suppressClick = useRef(false);
  const touchX = useRef<number | null>(null);
  const safeIdx = Math.min(idx, spreads.length - 1);
  const spread = spreads[safeIdx] ?? [1];

  useEffect(() => onPage(spread[0]!), [spread, onPage]);
  useEffect(() => {
    if (!jump || turning.current) return;
    const i = spreads.findIndex((s) => s.includes(jump.page));
    if (i >= 0) setIdx(i);
  }, [jump, spreads]);

  const slotsFor = (value: number[]) => narrow
    ? [value[0] ?? null]
    : value.length === 2
      ? value
      : value[0] === 1
        ? [null, 1]
        : [value[0] ?? null, null];

  /** Starts a turn only when both faces are already rendered. */
  const startTurn = (d: 1 | -1): boolean => {
    if (turning.current) return false;
    const next = safeIdx + d;
    if (next < 0 || next >= spreads.length) return false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fromSlots = slotsFor(spreads[safeIdx]!);
    const toSlots = slotsFor(spreads[next]!);
    const frontN = fromSlots[d > 0 ? 1 : 0];
    const backN = toSlots[d > 0 ? 0 : 1];
    const front = frontN ? getCached(doc, frontN) : null;
    const back = backN ? getCached(doc, backN) ?? null : null;
    if (reduced || !turner.current?.ready() || !front || (backN && !back)) {
      // Immediate change keeps the current spread until the next is shown.
      setIdx(next);
      return false;
    }
    turning.current = true;
    turner.current.begin(front, back, d);
    setTurn({ dir: d, from: safeIdx, to: next });
    return true;
  };
  const endTurn = (to: number) => (completed: boolean) => {
    if (completed) setIdx(to);
    setTurn(null);
    turning.current = false;
  };
  const flip = (d: 1 | -1) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const to = safeIdx + d;
    if (startTurn(d)) turner.current?.release(true, endTurn(to));
  };
  const flipRef = useRef(flip);
  flipRef.current = flip;

  const cornerDown = (d: 1 | -1) => (e: React.PointerEvent) => {
    suppressClick.current = false;
    if (turning.current || e.button !== 0) return;
    const w = stage.current?.clientWidth ?? 1;
    dragState.current = { dir: d, x: e.clientX, w, started: false, p: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const cornerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s) return;
    const dx = (e.clientX - s.x) * -s.dir;
    if (!s.started) {
      if (dx < 6) return;
      if (!startTurn(s.dir)) {
        dragState.current = null;
        suppressClick.current = true;
        return;
      }
      s.started = true;
    }
    s.p = Math.max(0, Math.min(1, dx / s.w));
    turner.current?.drag(s.p);
  };
  const cornerUp = () => {
    const s = dragState.current;
    dragState.current = null;
    if (!s?.started) return;
    suppressClick.current = true;
    turner.current?.release(s.p > 0.5, endTurn(safeIdx + s.dir));
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") flipRef.current(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") flipRef.current(-1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  // While turning, the destination sits underneath the moving sheet. The
  // stationary half of the old spread remains above it until the turn ends.
  const destination = turn ? spreads[turn.to] ?? spread : spread;
  const sourceSpread = turn ? spreads[turn.from] ?? spread : spread;
  const slots = slotsFor(destination);
  const sourceSlots = slotsFor(sourceSpread);
  const ref = sizes[0] ?? { w: 1, h: 1 };
  const atStart = safeIdx === 0;
  const atEnd = safeIdx === spreads.length - 1;
  const label = spread.length === 2 ? `Pages ${spread[0]}–${spread[1]} of ${sizes.length}` : `Page ${spread[0]} of ${sizes.length}`;
  const stationarySlot = turn && !narrow ? (turn.dir > 0 ? 0 : 1) : null;
  const standalone = slots.filter(Boolean).length === 1;
  const studio = viewer.look === "studio";

  return (
    <div className={zoom > 1 ? "relative z-0 isolate overflow-x-auto" : "relative z-0 isolate overflow-visible"}>
      <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 -z-10 w-1/2 max-w-[700px]">
        {[...(spreads[safeIdx + 1] ?? []), ...(spreads[safeIdx - 1] ?? [])].map((n) => (
          <PdfPage key={`warm-${n}`} doc={doc} n={n} size={sizes[n - 1] ?? ref} zoom={zoom} onVisible={noop} eager thumb />
        ))}
      </div>
      <div
        className="mx-auto px-4 pb-8 pt-10 sm:px-10 sm:pt-12"
        style={{ width: `${zoom * 94}%`, maxWidth: zoom <= 1 ? 1240 : undefined, minWidth: zoom > 1 ? `${zoom * 94}%` : undefined }}
        onTouchStart={(e) => (touchX.current = e.touches.length === 1 && zoom <= 1 ? e.touches[0]?.clientX ?? null : null)}
        onTouchMove={(e) => e.touches.length > 1 && (touchX.current = null)}
        onTouchEnd={(e) => {
          const x = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (x == null || end == null || Math.abs(end - x) < 50 || dragState.current) return;
          if ((e.target as HTMLElement).closest("button")) return;
          flip(end < x ? 1 : -1);
        }}
      >
        <div className="relative" style={{ aspectRatio: narrow ? `${ref.w} / ${ref.h}` : `${ref.w * 2} / ${ref.h}` }} aria-label={label}>
          <div
            ref={stage}
            className={cn(
              "pf-book-stage absolute inset-y-0 grid transition-[left,width] duration-300 ease-out",
              narrow ? "left-0 w-full grid-cols-1" : standalone ? "left-1/4 w-1/2 grid-cols-1" : "left-0 w-full grid-cols-2",
              studio && "pf-book-studio",
              studio && `pf-book-shadow-${viewer.shadow}`,
              studio && `pf-book-thickness-${viewer.thickness}`,
              studio && `pf-book-finish-${viewer.finish}`,
              studio && `pf-book-paper-${viewer.paper}`,
              studio && `pf-book-light-${viewer.light}`,
            )}
          >
            {slots.filter((n) => narrow ? Boolean(n) : true).map((n, i) => (
              <div key={`base-${i}`} className="relative min-w-0 overflow-hidden bg-foreground">
                {n && <PdfPage doc={doc} n={n} size={sizes[n - 1] ?? ref} zoom={zoom} onVisible={noop} eager />}
                {!narrow && !standalone && n && <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 w-px bg-foreground/20", i === 0 ? "right-0" : "left-0")} />}
              </div>
            ))}
            {turn && stationarySlot !== null && !standalone && (
              <div
                aria-hidden
                className="absolute inset-y-0 z-[2] overflow-hidden bg-foreground"
                style={{ left: stationarySlot === 0 ? 0 : "50%", width: "50%" }}
              >
                {sourceSlots[stationarySlot] && (
                  <PdfPage doc={doc} n={sourceSlots[stationarySlot] ?? 1} size={sizes[(sourceSlots[stationarySlot] ?? 1) - 1] ?? ref} zoom={zoom} onVisible={noop} eager />
                )}
              </div>
            )}
            <CurvedPage ref={turner} ratio={ref.h / ref.w} />
            {!atEnd && (
              <button type="button" onClick={() => flip(1)} onPointerDown={cornerDown(1)} onPointerMove={cornerMove} onPointerUp={cornerUp} onPointerCancel={cornerUp} aria-label="Turn to next page" title="Next page — click or drag" className="group absolute bottom-0 right-0 z-[4] size-16 touch-none overflow-hidden">
                <span className="absolute bottom-0 right-0 size-7 bg-muted shadow-md [clip-path:polygon(100%_0,0_100%,0_0)] transition-all duration-200 group-hover:size-12 group-focus-visible:size-12" />
              </button>
            )}
            {!atStart && (
              <button type="button" onClick={() => flip(-1)} onPointerDown={cornerDown(-1)} onPointerMove={cornerMove} onPointerUp={cornerUp} onPointerCancel={cornerUp} aria-label="Turn to previous page" title="Previous page — click or drag" className="group absolute bottom-0 left-0 z-[4] size-16 touch-none overflow-hidden">
                <span className="absolute bottom-0 left-0 size-7 bg-muted shadow-md [clip-path:polygon(0_0,100%_0,100%_100%)] transition-all duration-200 group-hover:size-12 group-focus-visible:size-12" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className={cn("flex items-center justify-center gap-3 pb-6 text-xs transition-opacity duration-200", controlsHidden && "pointer-events-none opacity-0")}>
        <button type="button" onClick={() => flip(-1)} disabled={atStart || !!turn} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-1.5 hover:border-foreground disabled:opacity-30">
          <ChevronLeft className="size-3.5" /> Previous
        </button>
        <span aria-live="polite" className="min-w-32 text-center tabular-nums text-background/70">{label}</span>
        <button type="button" onClick={() => flip(1)} disabled={atEnd || !!turn} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-1.5 hover:border-foreground disabled:opacity-30">
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

// Rendered pages are cached per document so a page that appears in a new
// place (turning sheet, stationary half, next spread) paints instantly.
// A shared byte budget evicts the least recently used pages.
const pageCache = new WeakMap<object, Map<number, HTMLCanvasElement>>();
const lru = new Map<HTMLCanvasElement, { doc: object; n: number }>();
let cacheBytes = 0;
function cacheBudget() {
  if (typeof window === "undefined") return 0;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  return (mem <= 4 || window.innerWidth < 768 ? 60 : 150) * 1024 * 1024;
}
function getCached(doc: object, n: number) {
  const c = pageCache.get(doc)?.get(n);
  if (c) {
    const meta = lru.get(c);
    if (meta) {
      lru.delete(c);
      lru.set(c, meta);
    }
  }
  return c;
}
function cachedCopy(doc: object, n: number) {
  const src = getCached(doc, n);
  if (!src) return null;
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.style.width = "100%";
  c.style.height = "100%";
  c.setAttribute("aria-hidden", "true");
  c.getContext("2d")!.drawImage(src, 0, 0);
  return c;
}
function storePage(doc: object, n: number, canvas: HTMLCanvasElement) {
  let m = pageCache.get(doc);
  if (!m) pageCache.set(doc, (m = new Map()));
  const prev = m.get(n);
  if (prev && prev.width >= canvas.width) return;
  if (prev) {
    lru.delete(prev);
    cacheBytes -= prev.width * prev.height * 4;
  }
  m.set(n, canvas);
  lru.set(canvas, { doc, n });
  cacheBytes += canvas.width * canvas.height * 4;
  const budget = cacheBudget();
  for (const [c, meta] of lru) {
    if (cacheBytes <= budget || lru.size <= 6) break;
    lru.delete(c);
    cacheBytes -= c.width * c.height * 4;
    const dm = pageCache.get(meta.doc);
    if (dm?.get(meta.n) === c) dm.delete(meta.n);
    c.width = c.height = 0; // release pixel memory
  }
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

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.firstChild) return;
    const copy = cachedCopy(doc, n);
    if (copy) el.replaceChildren(copy);
  }, [doc, n]);

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
        { const keep = document.createElement("canvas"); keep.width = canvas.width; keep.height = canvas.height; keep.getContext("2d")!.drawImage(canvas, 0, 0); storePage(doc, n, keep); }
        if (thumb) {
          const copy = cachedCopy(doc, n);
          el.replaceChildren(copy ?? canvas);
          return;
        }
        if (false) {
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
