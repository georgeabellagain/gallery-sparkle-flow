import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { ViewerSettings } from "@/lib/portfolia/store";
import {
  bookFocus,
  bookLayout,
  spreadIndex,
  type Leaf,
  type Spread,
} from "@/lib/portfolia/book-layout";
import {
  createBookScene,
  type BookFaces,
  type BookScene,
  type StudioSettings,
} from "@/lib/portfolia/book-scene";
import { cn } from "@/lib/utils";

const BACKDROPS = [
  { id: "warm-wood", label: "Warm wood", image: "/studio/warm-wood.jpg" },
  { id: "light-wood", label: "Light wood", image: "/studio/light-wood.jpg" },
  { id: "plain", label: "Plain", image: "" },
];

/** A bounded per-view cache. All turn faces finish rendering before motion starts. */
function pageLoader(doc: PDFDocumentProxy, ratio: number) {
  const cache = new Map<number, HTMLCanvasElement>();
  const pending = new Map<number, Promise<HTMLCanvasElement>>();
  const tasks = new Set<RenderTask>();
  let closed = false;
  const load = (page: number): Promise<HTMLCanvasElement> => {
    const hit = cache.get(page);
    if (hit) {
      cache.delete(page);
      cache.set(page, hit);
      return Promise.resolve(hit);
    }
    const existing = pending.get(page);
    if (existing) return existing;
    const promise = (async () => {
      const pdfPage = await doc.getPage(page);
      if (closed) throw new Error("Viewer closed");
      const original = pdfPage.getViewport({ scale: 1 });
      const target = Math.min(
        1800,
        Math.max(1000, window.innerWidth * Math.min(devicePixelRatio || 1, 2)),
      );
      const viewport = pdfPage.getViewport({
        scale: target / Math.max(original.width, original.height),
      });
      const raw = document.createElement("canvas");
      raw.width = Math.ceil(viewport.width);
      raw.height = Math.ceil(viewport.height);
      const task = pdfPage.render({ canvasContext: raw.getContext("2d")!, viewport });
      tasks.add(task);
      try {
        await task.promise;
      } finally {
        tasks.delete(task);
      }
      if (closed) throw new Error("Viewer closed");
      cache.set(page, raw);
      while (cache.size > 8) cache.delete(cache.keys().next().value!);
      return raw;
    })().finally(() => pending.delete(page));
    pending.set(page, promise);
    return promise;
  };
  return {
    async face(leaf: Leaf | undefined): Promise<HTMLCanvasElement | null> {
      if (!leaf) return null;
      const raw = await load(leaf.page);
      const canvas = document.createElement("canvas");
      canvas.width = leaf.half ? Math.floor(raw.width / 2) : raw.width;
      canvas.height = Math.round(canvas.width * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const sw = leaf.half ? raw.width / 2 : raw.width;
      const sx = leaf.half === "right" ? raw.width / 2 : 0;
      const scale = Math.min(canvas.width / sw, canvas.height / raw.height);
      const w = sw * scale,
        h = raw.height * scale;
      ctx.drawImage(
        raw,
        sx,
        0,
        sw,
        raw.height,
        (canvas.width - w) / 2,
        (canvas.height - h) / 2,
        w,
        h,
      );
      return canvas;
    },
    dispose() {
      closed = true;
      tasks.forEach((task) => task.cancel());
      cache.clear();
    },
  };
}

export function BookView({
  doc,
  sizes,
  zoom,
  onZoomChange,
  jump,
  onPage,
  controlsHidden,
  viewer,
}: {
  doc: PDFDocumentProxy;
  sizes: { w: number; h: number }[];
  zoom: number;
  onZoomChange: (zoom: number) => void;
  jump: { page: number; t: number } | null;
  onPage: (page: number) => void;
  controlsHidden: boolean;
  viewer: ViewerSettings;
}) {
  const layout = useMemo(
    () => bookLayout(doc.numPages, viewer.spreads === "ready"),
    [doc, viewer.spreads],
  );
  const first = sizes[0] ?? { w: 1, h: 1.4 };
  const ratio = first.h / (viewer.spreads === "ready" ? first.w / 2 : first.w);
  const host = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wheelZoom = useRef(zoom);
  const scene = useRef<BookScene | null>(null);
  const loader = useRef<ReturnType<typeof pageLoader> | null>(null);
  const lock = useRef(false);
  const epoch = useRef(0);
  const alive = useRef(true);
  const [ready, setReady] = useState(0);
  const [corners, setCorners] = useState([
    { x: 8, y: 86 },
    { x: 92, y: 86 },
  ]);
  const [leaf, setLeaf] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const fallbackCanvas = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<StudioSettings>({
    studio: viewer.look === "studio",
    material: viewer.finish,
    lighting: viewer.light,
    backdrop: "/studio/warm-wood.jpg",
  });
  const [backdrop, setBackdrop] = useState("warm-wood");
  const [cue, setCue] = useState<"left" | "right" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = spreadIndex(layout.spreads, leaf);
  const spread = layout.spreads[index]!;
  const focus = bookFocus(spread, leaf, narrow);
  const atStart = narrow ? leaf === 0 : index === 0;
  const atEnd = narrow ? leaf === layout.leaves.length - 1 : index === layout.spreads.length - 1;
  const current = layout.leaves[leaf]!;
  const pages = spread.filter((n): n is number => n !== null).map((n) => layout.leaves[n]!.page);
  const label =
    narrow || new Set(pages).size === 1
      ? `Page ${current.page} of ${doc.numPages}${narrow && current.half ? ` · ${current.half}` : ""}`
      : `Pages ${pages[0]}–${pages[1]} of ${doc.numPages}`;

  useEffect(() => {
    alive.current = true;
    const element = host.current!;
    const generation = epoch;
    const observer = new ResizeObserver(() => setNarrow(element.clientWidth < 720));
    observer.observe(element);
    setNarrow(element.clientWidth < 720);
    const source = pageLoader(doc, ratio);
    loader.current = source;
    try {
      scene.current = createBookScene(element, ratio, () => {
        if (alive.current) setFallback(true);
      });
    } catch {
      setFallback(true);
    }
    setReady((v) => v + 1);
    return () => {
      alive.current = false;
      generation.current++;
      observer.disconnect();
      source.dispose();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [doc, ratio]);

  const faces = useCallback(
    async (value: Spread): Promise<BookFaces> => {
      return Promise.all(
        value.map((n) => loader.current!.face(n === null ? undefined : layout.leaves[n])),
      ) as Promise<BookFaces>;
    },
    [layout],
  );

  useEffect(() => {
    onPage(current.page);
  }, [current.page, onPage]);
  useEffect(() => {
    if (!jump) return;
    const found = layout.leaves.findIndex((l) => l.page === jump.page);
    if (found >= 0 && !lock.current) setLeaf(found);
  }, [jump, layout]);
  useEffect(() => {
    scene.current?.configure({
      ...settings,
      backdrop: BACKDROPS.find((b) => b.id === backdrop)!.image,
    });
  }, [settings, backdrop, ready]);
  useEffect(() => {
    if (!busy && scene.current) {
      scene.current.viewport(narrow, zoom, focus);
      setCorners(scene.current.corners());
    }
    wheelZoom.current = zoom;
  }, [narrow, zoom, focus, busy, ready, settings]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || fallback) return;
    const onWheel = (event: WheelEvent) => {
      if (busy || loading || !scene.current) return;
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const next = Math.min(3, Math.max(0.5, wheelZoom.current * Math.exp(-dy * 0.0015)));
      if (Math.abs(next - wheelZoom.current) < 0.001) return;
      const rect = element.getBoundingClientRect();
      scene.current.zoomAt(next, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
      wheelZoom.current = next;
      onZoomChange(next);
      setCorners(scene.current.corners());
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [busy, loading, fallback, onZoomChange]);

  useEffect(() => {
    if (!ready) return;
    const token = ++epoch.current;
    setLoading(true);
    setError(null);
    void faces(spread)
      .then((value) => {
        if (!alive.current || token !== epoch.current) return;
        scene.current?.show(value);
        const canvas = fallbackCanvas.current;
        if (canvas) {
          const image = value[spread[0] === leaf ? 0 : 1];
          if (image) {
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext("2d")!.drawImage(image, 0, 0);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        if (alive.current && token === epoch.current) {
          setError("This page could not be rendered. Try another page or switch reading mode.");
          setLoading(false);
        }
      });
  }, [faces, spread, leaf, ready, fallback]);

  const move = useCallback(
    async (direction: 1 | -1) => {
      if (lock.current || loading || (direction === 1 ? atEnd : atStart)) return;
      const nextIndex = narrow ? spreadIndex(layout.spreads, leaf + direction) : index + direction;
      const nextSpread = layout.spreads[nextIndex]!;
      const nextLeaf = narrow ? leaf + direction : nextSpread.find((n) => n !== null)!;
      const target = bookFocus(nextSpread, nextLeaf, narrow);
      lock.current = true;
      setBusy(true);
      setCue(null);
      setError(null);
      try {
        const [from, to] = await Promise.all([faces(spread), faces(nextSpread)]);
        // Let the corner fold away before moving the book itself.
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          await new Promise((r) => setTimeout(r, 120));
        if (!alive.current) return;
        if (!fallback && scene.current) {
          await scene.current.resetZoom();
          if (alive.current) onZoomChange(1);
          if (!alive.current) return;
          if (index === nextIndex) await scene.current.pan(target);
          else await scene.current.turn(from, to, direction, target);
        }
        if (alive.current) setLeaf(nextLeaf);
      } catch {
        if (alive.current) setError("This page could not be rendered. Please try again.");
      } finally {
        lock.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [loading, atEnd, atStart, narrow, layout, leaf, index, faces, spread, fallback, onZoomChange],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, button, [contenteditable]"))
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        void move(1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        void move(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move]);
  const update = (patch: Partial<StudioSettings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <section
      className="pf-book-reader"
      aria-label="Interactive PDF book"
      data-look={settings.studio ? "studio" : "simple"}
    >
      <div className="pf-book-options">
        <div className="pf-book-switch" role="group" aria-label="Book appearance">
          <button
            type="button"
            aria-pressed={!settings.studio}
            onClick={() => update({ studio: false })}
          >
            Simple
          </button>
          <button
            type="button"
            aria-pressed={settings.studio}
            onClick={() => update({ studio: true })}
          >
            Studio
          </button>
        </div>
        {settings.studio && (
          <div className="pf-studio-controls">
            <label>
              Paper
              <select
                aria-label="Paper material"
                value={settings.material}
                onChange={(e) => update({ material: e.target.value as StudioSettings["material"] })}
              >
                <option value="matte">Matte</option>
                <option value="satin">Satin</option>
                <option value="textured">Textured</option>
                <option value="natural">Natural</option>
              </select>
            </label>
            <label>
              Light
              <select
                aria-label="Lighting style"
                value={settings.lighting}
                onChange={(e) => update({ lighting: e.target.value as StudioSettings["lighting"] })}
              >
                <option value="soft">Soft daylight</option>
                <option value="bright">Bright studio</option>
                <option value="warm">Warm evening</option>
              </select>
            </label>
          </div>
        )}
      </div>
      {settings.studio && (
        <div className="pf-backdrops" role="group" aria-label="Studio backdrop">
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={backdrop === b.id}
              onClick={() => setBackdrop(b.id)}
            >
              <span
                aria-hidden
                style={{ backgroundImage: b.image ? `url(${b.image})` : undefined }}
              />
              {b.label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={viewportRef}
        className="pf-book-viewport"
        data-busy={busy || loading}
        data-narrow={narrow}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || busy || narrow) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 100,
            y = ((e.clientY - r.top) / r.height) * 100;
          setCue(
            Math.abs(x - corners[0]!.x) < 15 && Math.abs(y - corners[0]!.y) < 18 && !atStart
              ? "left"
              : Math.abs(x - corners[1]!.x) < 15 && Math.abs(y - corners[1]!.y) < 18 && !atEnd
                ? "right"
                : null,
          );
        }}
        onPointerLeave={() => {
          setCue(null);
        }}
        onTouchStart={(e) => {
          touch.current =
            e.touches.length === 1 && zoom <= 1
              ? { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }
              : null;
        }}
        onTouchMove={(e) => {
          if (e.touches.length !== 1) touch.current = null;
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          const end = e.changedTouches[0];
          if (!start || !end) return;
          const dx = end.clientX - start.x,
            dy = end.clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) void move(dx < 0 ? 1 : -1);
        }}
      >
        <div ref={host} className={cn("pf-book-canvas", fallback && "invisible")} />
        {fallback && (
          <div className="pf-book-fallback">
            <canvas ref={fallbackCanvas} />
            <p>3D is unavailable on this device. You can still read every page.</p>
          </div>
        )}
        {!narrow &&
          !fallback &&
          (
            [
              [-1, "left"],
              [1, "right"],
            ] as const
          ).map(([d, side]) => (
            <button
              key={side}
              type="button"
              className={`pf-corner-zone pf-corner-${side}`}
              style={{
                left: `${corners[side === "left" ? 0 : 1]!.x}%`,
                top: `${corners[side === "left" ? 0 : 1]!.y}%`,
              }}
              aria-label={d === 1 ? "Turn to next page" : "Turn to previous page"}
              disabled={busy || loading || (d === 1 ? atEnd : atStart)}
              data-revealed={cue === side && !busy}
              onFocus={() => {
                setCue(side);
              }}
              onBlur={() => setCue(null)}
              onClick={() => void move(d)}
            >
              <span className="pf-corner-fold" />
            </button>
          ))}
        {loading && (
          <p className="pf-book-status" role="status">
            Preparing pages…
          </p>
        )}
        {error && (
          <p className="pf-book-status" role="alert">
            {error}
          </p>
        )}
      </div>
      <nav
        aria-label="Book pages"
        className={cn("pf-book-navigation", controlsHidden && "pf-book-navigation-quiet")}
      >
        <button type="button" onClick={() => void move(-1)} disabled={busy || loading || atStart}>
          <ChevronLeft size={15} />
          Previous
        </button>
        <span aria-live="polite">{label}</span>
        <button type="button" onClick={() => void move(1)} disabled={busy || loading || atEnd}>
          Next
          <ChevronRight size={15} />
        </button>
      </nav>
      {narrow && (
        <p className="pf-book-hint">
          Swipe or use the arrows to read. The camera follows each page.
        </p>
      )}
    </section>
  );
}
