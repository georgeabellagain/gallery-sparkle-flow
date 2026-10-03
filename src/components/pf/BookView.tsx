import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
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
  HDRI_PRESETS,
  type BookFaces,
  type BookScene,
  type StudioSettings,
} from "@/lib/portfolia/book-scene";
import { cn } from "@/lib/utils";
import type { BackgroundFit } from "@/lib/portfolia/background";
import { BackdropLayer, IconButton, Panel, Segmented, useDismiss, type Tone } from "@/components/pf/viewer-ui";

/** The studio options a visitor can change. */
type Look = Pick<StudioSettings, "studio" | "material" | "brightness" | "hdri">;

/** The most turns that can be queued up by clicking quickly. */
const MAX_QUEUE = 12;


/**
 * Renders every page once into a ready-to-use face and keeps them in a bounded
 * cache. A turn then only hands existing canvases to the scene, with no
 * rendering or copying at the moment the page moves. Pages are rendered up
 * front, within a memory budget, so turning never waits.
 */
function pageLoader(doc: PDFDocumentProxy, ratio: number, layout: ReturnType<typeof bookLayout>) {
  const faces = new Map<number, HTMLCanvasElement>();
  const pending = new Map<number, Promise<void>>();
  const tasks = new Set<RenderTask>();
  let closed = false;

  const leavesOf = new Map<number, number[]>();
  layout.leaves.forEach((leaf, index) => {
    const list = leavesOf.get(leaf.page);
    if (list) list.push(index);
    else leavesOf.set(leaf.page, [index]);
  });

  // Keep every page in memory when it fits. Longer documents render each page
  // a little smaller so they still fit instead of exhausting the device.
  const split = layout.leaves.some((leaf) => leaf.half) ? 0.5 : 1;
  const perPage = split === 0.5 ? 2 : 1;
  const count = layout.leaves.length;
  const budget = (window.innerWidth < 720 ? 160 : 360) * 1024 * 1024;
  const ideal = Math.min(
    4096,
    Math.max(2560, window.innerWidth * Math.min(devicePixelRatio || 1, 3)),
  );
  const fitted = Math.sqrt(budget / (3 * split * Math.min(count, 60)));
  const target = Math.max(1200, Math.min(ideal, fitted));
  const keep = Math.max(8, Math.min(count, Math.floor(budget / (3 * split * target * target))));

  const compose = (raw: HTMLCanvasElement, leaf: Leaf, index: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = leaf.half ? Math.floor(raw.width / 2) : raw.width;
    canvas.height = Math.round(canvas.width * ratio);
    // Each page's position in the book gives it its own, repeatable imperfections.
    canvas.dataset.seed = String(index);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
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
  };

  const render = (page: number): Promise<void> => {
    const existing = pending.get(page);
    if (existing) return existing;
    const promise = (async () => {
      const pdfPage = await doc.getPage(page);
      if (closed) throw new Error("Viewer closed");
      const original = pdfPage.getViewport({ scale: 1 });
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
      for (const index of leavesOf.get(page) ?? []) faces.set(index, compose(raw, layout.leaves[index]!, index));
      // The faces hold the pixels now; release the full-size render straight away.
      raw.width = raw.height = 0;
      while (faces.size > keep) faces.delete(faces.keys().next().value!);
    })().finally(() => pending.delete(page));
    pending.set(page, promise);
    return promise;
  };

  return {
    /**
     * Renders pages in the background. Resolves once the first `gate` pages are
     * ready; any remaining pages keep loading afterwards.
     */
    preload(onProgress: (done: number, total: number) => void): Promise<void> {
      const total = Math.min(doc.numPages, Math.floor(keep / perPage));
      const gate = Math.min(total, 40);
      return new Promise<void>((resolve) => {
        let next = 1;
        let done = 0;
        const worker = async () => {
          while (!closed) {
            const page = next++;
            if (page > total) return;
            try {
              await render(page);
            } catch {
              /* a page that fails here is retried when it is opened */
            }
            done++;
            onProgress(Math.min(done, gate), gate);
            if (done >= gate) resolve();
          }
        };
        void Promise.all([worker(), worker()]).then(() => resolve());
      });
    },
    async face(index: number | null): Promise<HTMLCanvasElement | null> {
      if (index === null) return null;
      let hit = faces.get(index);
      if (!hit) {
        await render(layout.leaves[index]!.page);
        hit = faces.get(index);
        if (!hit) throw new Error("Page unavailable");
      }
      faces.delete(index);
      faces.set(index, hit);
      return hit;
    },
    dispose() {
      closed = true;
      tasks.forEach((task) => task.cancel());
      faces.clear();
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
  viewer,
  colour,
  backgroundUrl,
  tone,
  immersive,
}: {
  doc: PDFDocumentProxy;
  sizes: { w: number; h: number }[];
  zoom: number;
  onZoomChange: (zoom: number) => void;
  jump: { page: number; t: number } | null;
  onPage: (page: number) => void;
  viewer: ViewerSettings;
  /** The colour behind the book. */
  colour: string;
  /** A picture behind the book instead of the colour. */
  backgroundUrl?: string;
  /** Whether that backdrop is light or dark, so the icons can stay readable. */
  tone: Tone;
  /** Fill most of the screen (a published portfolio) rather than a preview. */
  immersive?: boolean;
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
  const zoomFrame = useRef(0);
  const scene = useRef<BookScene | null>(null);
  const loader = useRef<ReturnType<typeof pageLoader> | null>(null);
  const lock = useRef(false);
  const queued = useRef(0);
  const epoch = useRef(0);
  const alive = useRef(true);
  const shown = useRef<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(0);
  const [warm, setWarm] = useState(false);
  const [warmProgress, setWarmProgress] = useState({ done: 0, total: 0 });
  const [corners, setCorners] = useState([
    { x: 8, y: 86 },
    { x: 92, y: 86 },
  ]);
  const [leaf, setLeaf] = useState(0);
  // The page the book is really on. Updated the instant a turn lands, so a very quick
  // click never works from stale information while React is still catching up.
  const leafRef = useRef(0);
  const goTo = useCallback((next: number) => {
    leafRef.current = next;
    setLeaf(next);
  }, []);
  const [narrow, setNarrow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const fallbackCanvas = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<Look>({
    studio: viewer.look === "studio",
    material: viewer.finish === "textured" ? "textured" : "satin",
    brightness: 0.65,
    hdri: HDRI_PRESETS[0]!.id,
  });
  const [open, setOpen] = useState(false);
  useDismiss(settingsRef, open, () => setOpen(false));
  const touch = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; dir: 1 | -1; from: number; progress: number; prepared: Promise<void>; moved: boolean } | null>(null);
  const panning = useRef<{ id: number; x: number; y: number } | null>(null);
  const prefetchToken = useRef(0);
  const index = spreadIndex(layout.spreads, leaf);
  const spread = layout.spreads[index]!;
  const focus = bookFocus(spread, leaf, narrow);
  const atStart = narrow ? leaf === 0 : index === 0;
  const atEnd = narrow ? leaf === layout.leaves.length - 1 : index === layout.spreads.length - 1;
  const current = layout.leaves[leaf]!;
  const pages = spread.filter((n): n is number => n !== null).map((n) => layout.leaves[n]!.page);
  /** Turning waits until every page has been prepared. */
  const wait = loading || !warm;
  const label =
    narrow || new Set(pages).size === 1
      ? `Page ${current.page} of ${doc.numPages}${narrow && current.half ? ` · ${current.half}` : ""}`
      : `Pages ${pages[0]}–${pages[1]} of ${doc.numPages}`;

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const element = host.current!;
    const generation = epoch;
    const observer = new ResizeObserver(() => setNarrow(element.clientWidth < 720));
    observer.observe(element);
    setNarrow(element.clientWidth < 720);
    const source = pageLoader(doc, ratio, layout);
    loader.current = source;
    setWarm(false);
    setWarmProgress({ done: 0, total: 0 });
    void source.preload((done, total) => {
      if (!cancelled) setWarmProgress({ done, total });
    }).then(() => {
      if (!cancelled) setWarm(true);
    });
    try {
      scene.current = createBookScene(element, ratio, () => {
        if (alive.current) setFallback(true);
      });
    } catch {
      setFallback(true);
    }
    setReady((v) => v + 1);
    return () => {
      cancelled = true;
      alive.current = false;
      queued.current = 0;
      generation.current++;
      observer.disconnect();
      source.dispose();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [doc, ratio, layout]);

  const faces = useCallback(
    async (value: Spread): Promise<BookFaces> => {
      return Promise.all(value.map((n) => loader.current!.face(n))) as Promise<BookFaces>;
    },
    [],
  );

  useEffect(() => {
    onPage(current.page);
  }, [current.page, onPage]);
  useEffect(() => {
    if (!jump) return;
    const found = layout.leaves.findIndex((l) => l.page === jump.page);
    if (found >= 0 && !lock.current) goTo(found);
  }, [jump, layout, goTo]);
  useEffect(() => {
    scene.current?.configure(settings);
  }, [settings, ready]);
  useEffect(() => {
    if (!busy && scene.current) {
      // A wheel gesture that has not reached the parent yet owns the zoom.
      scene.current.viewport(narrow, zoomFrame.current ? wheelZoom.current : zoom, focus);
      setCorners(scene.current.corners());
    }
    if (!zoomFrame.current) wheelZoom.current = zoom;
  }, [narrow, zoom, focus, busy, ready, settings]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || fallback) return;
    const onWheel = (event: WheelEvent) => {
      if (busy || wait || !scene.current) return;
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const next = Math.min(3, Math.max(0.8, wheelZoom.current * Math.exp(-dy * 0.0015)));
      if (Math.abs(next - wheelZoom.current) < 0.001) return;
      const rect = element.getBoundingClientRect();
      scene.current.zoomAt(next, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
      wheelZoom.current = next;
      // Tell React once per frame instead of on every wheel tick.
      if (!zoomFrame.current) {
        zoomFrame.current = requestAnimationFrame(() => {
          zoomFrame.current = 0;
          onZoomChange(wheelZoom.current);
          if (scene.current) setCorners(scene.current.corners());
        });
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      if (zoomFrame.current) cancelAnimationFrame(zoomFrame.current);
      zoomFrame.current = 0;
    };
  }, [busy, wait, fallback, onZoomChange]);

  useEffect(() => {
    if (!ready) return;
    // After a page turn the scene already shows this spread: do not rebuild it.
    const key = `${ready}|${spread.join(",")}|${fallback ? leaf : ""}`;
    if (shown.current === key) {
      setLoading(false);
      return;
    }
    const token = ++epoch.current;
    setLoading(true);
    setError(null);
    void faces(spread)
      .then((value) => {
        if (!alive.current || token !== epoch.current) return;
        scene.current?.show(value);
        shown.current = key;
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

  // While the book is at rest, upload the neighbouring spreads to the GPU one
  // page at a time, so the next turn starts instantly.
  useEffect(() => {
    if (!ready || !warm || busy || loading || fallback) return;
    const token = ++prefetchToken.current;
    const targets = [index + 1, index - 1]
      .flatMap((i) => layout.spreads[i] ?? [])
      .filter((n): n is number => n !== null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let k = 0;
    const step = async () => {
      if (!alive.current || token !== prefetchToken.current || k >= targets.length) return;
      try {
        const canvas = await loader.current?.face(targets[k++]!);
        if (alive.current && token === prefetchToken.current && !lock.current) scene.current?.prefetch(canvas);
      } catch {
        /* a page that cannot be prepared reports its own error when opened */
      }
      timer = setTimeout(() => void step(), 90);
    };
    timer = setTimeout(() => void step(), 200);
    return () => {
      prefetchToken.current++;
      if (timer) clearTimeout(timer);
    };
  }, [index, ready, warm, busy, loading, fallback, layout]);

  /** Remembers a click that arrives mid-turn, so quick clicking moves quickly through the pages. */
  const queueStep = (direction: 1 | -1) => {
    queued.current = Math.max(-MAX_QUEUE, Math.min(MAX_QUEUE, queued.current + direction));
  };

  const move = useCallback(
    async (direction: 1 | -1, chained = false) => {
      if (wait) return;
      // A turn is in progress: keep the click and run it the moment the book is free.
      if (lock.current) {
        queueStep(direction);
        return;
      }
      const fromLeaf = leafRef.current;
      const fromIndex = spreadIndex(layout.spreads, fromLeaf);
      const fromSpread = layout.spreads[fromIndex]!;
      const isStart = narrow ? fromLeaf === 0 : fromIndex === 0;
      const isEnd = narrow ? fromLeaf === layout.leaves.length - 1 : fromIndex === layout.spreads.length - 1;
      if (direction === 1 ? isEnd : isStart) return;
      // Turns that follow one another run faster so the pages keep up with the clicks.
      const quick = chained || queued.current !== 0;
      const nextIndex = narrow ? spreadIndex(layout.spreads, fromLeaf + direction) : fromIndex + direction;
      const nextSpread = layout.spreads[nextIndex]!;
      const nextLeaf = narrow ? fromLeaf + direction : nextSpread.find((n) => n !== null)!;
      const target = bookFocus(nextSpread, nextLeaf, narrow);
      lock.current = true;
      setBusy(true);
      setError(null);
      try {
        const [from, to] = await Promise.all([faces(fromSpread), faces(nextSpread)]);
        if (!alive.current) return;
        if (!fallback && scene.current) {
          await scene.current.resetZoom();
          if (alive.current) onZoomChange(1);
          if (!alive.current) return;
          if (fromIndex === nextIndex) await scene.current.pan(target, quick ? 200 : 420);
          else await scene.current.turn(from, to, direction, target, quick ? 0.5 : 1);
          shown.current = `${ready}|${nextSpread.join(",")}|`;
        }
        if (alive.current) goTo(nextLeaf);
      } catch {
        if (alive.current) setError("This page could not be rendered. Please try again.");
      } finally {
        lock.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [wait, narrow, layout, faces, fallback, onZoomChange, ready, goTo],
  );

  // When a turn ends, carry on with any clicks that arrived during it.
  useEffect(() => {
    if (busy || wait || queued.current === 0) return;
    const direction: 1 | -1 = queued.current > 0 ? 1 : -1;
    if (direction === 1 ? atEnd : atStart) {
      queued.current = 0;
      return;
    }
    queued.current -= direction;
    void move(direction, true);
  }, [busy, wait, atEnd, atStart, move]);

  const beginCornerDrag = (e: React.PointerEvent<HTMLButtonElement>, direction: 1 | -1) => {
    if (lock.current) {
      if (!wait) queueStep(direction);
      return;
    }
    const fromIndex = spreadIndex(layout.spreads, leafRef.current);
    const fromSpread = layout.spreads[fromIndex]!;
    if (wait || (direction === 1 ? fromIndex === layout.spreads.length - 1 : fromIndex === 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lock.current = true;
    setBusy(true);
    setError(null);
    const nextIndex = fromIndex + direction;
    const nextSpread = layout.spreads[nextIndex];
    if (!nextSpread) { lock.current = false; setBusy(false); return; }
    const nextLeaf = nextSpread.find((n) => n !== null);
    if (nextLeaf === undefined) { lock.current = false; setBusy(false); return; }
    const target = bookFocus(nextSpread, nextLeaf, narrow);
    const gesture = {
      id: e.pointerId, x: e.clientX, y: e.clientY,
      dir: direction, from: fromIndex, progress: 0, moved: false,
      prepared: Promise.resolve(),
    };
    drag.current = gesture;
    gesture.prepared = (async () => {
      const [from, to] = await Promise.all([faces(fromSpread), faces(nextSpread)]);
      if (!alive.current || !scene.current) return;
      await scene.current.resetZoom();
      if (!alive.current || !scene.current) return;
      onZoomChange(1);
      await scene.current.prepareTurn(from, to, direction, target);
      if (drag.current === gesture) scene.current.dragTurn(gesture.progress);
    })();
  };

  const finishCornerDrag = async (e: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = drag.current;
    if (!gesture || gesture.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const complete = !cancelled && (!gesture.moved || gesture.progress > 0.45);
    try {
      await gesture.prepared;
      if (!alive.current || !scene.current) return;
      scene.current.dragTurn(gesture.progress);
      await scene.current.settleTurn(complete);
      if (alive.current && complete) {
        const nextSpread = layout.spreads[gesture.from + gesture.dir];
        const nextLeaf = nextSpread?.find((n) => n !== null);
        if (nextSpread && nextLeaf !== undefined) {
          shown.current = `${ready}|${nextSpread.join(",")}|`;
          goTo(nextLeaf);
        }
      }
    } catch {
      if (alive.current) setError("This page could not be rendered. Please try again.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };

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
  const update = (patch: Partial<Look>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <section aria-label="Interactive PDF book" data-look={settings.studio ? "studio" : "simple"}>
      <div
        ref={viewportRef}
        className="pf-book-viewport"
        style={{ ...(immersive ? { height: "clamp(420px, calc(100svh - 3rem), 1100px)" } : {}), ...(zoom > 1 ? { touchAction: "none" } : {}) }}
        data-busy={busy || wait}
        data-narrow={narrow}
        data-panning={panning.current !== null}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && e.target !== host.current && e.target !== host.current?.firstChild) return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (zoom <= 1 || busy || wait || !scene.current) return;
          panning.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const pan = panning.current;
          if (!pan || pan.id !== e.pointerId) return;
          // The scene keeps the view inside the initial framing.
          scene.current?.dragPan(e.clientX - pan.x, e.clientY - pan.y);
          pan.x = e.clientX;
          pan.y = e.clientY;
          if (scene.current) setCorners(scene.current.corners());
        }}
        onPointerUp={(e) => {
          if (panning.current?.id === e.pointerId) panning.current = null;
        }}
        onPointerCancel={(e) => {
          if (panning.current?.id === e.pointerId) panning.current = null;
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
        <BackdropLayer colour={colour} imageUrl={backgroundUrl} fit={viewer.backgroundFit as Partial<BackgroundFit> | undefined} />
        <div ref={host} className={cn("pf-book-canvas", fallback && "invisible")} />
        {fallback && (
          <div className="pf-book-fallback">
            <canvas ref={fallbackCanvas} />
            <p>3D is unavailable on this device. You can still read every page.</p>
          </div>
        )}
        {/* Invisible but fully working: click a bottom corner, or drag it to turn. */}
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
              disabled={wait || (d === 1 ? atEnd : atStart)}
              onPointerDown={(e) => beginCornerDrag(e, d)}
              onPointerMove={(e) => {
                const gesture = drag.current;
                if (!gesture || gesture.id !== e.pointerId) return;
                if (Math.abs(e.clientX - gesture.x) > 4 || Math.abs(e.clientY - gesture.y) > 4) gesture.moved = true;
                const width = viewportRef.current?.clientWidth ?? 1;
                gesture.progress = Math.min(1, Math.max(0, gesture.dir * (gesture.x - e.clientX) / (width * 0.66)));
                scene.current?.dragTurn(gesture.progress);
              }}
              onPointerUp={(e) => void finishCornerDrag(e)}
              onPointerCancel={(e) => void finishCornerDrag(e, true)}
              onClick={(e) => { if (e.detail === 0) void move(d); }}
            />
          ))}
        {wait && !error && (
          <p className="pf-book-status" role="status">
            {warm || warmProgress.total === 0
              ? "Preparing pages…"
              : `Preparing pages… ${warmProgress.done} / ${warmProgress.total}`}
          </p>
        )}
        {error && (
          <p className="pf-book-status" role="alert">
            {error}
          </p>
        )}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-1.5">
          <IconButton label="Previous page" tone={tone} large className="pointer-events-auto" disabled={wait || atStart} onClick={() => void move(-1)}>
            <ChevronLeft className="size-6" />
          </IconButton>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-1.5">
          <IconButton label="Next page" tone={tone} large className="pointer-events-auto" disabled={wait || atEnd} onClick={() => void move(1)}>
            <ChevronRight className="size-6" />
          </IconButton>
        </div>
        <p aria-live="polite" className={cn("pointer-events-none absolute inset-x-0 bottom-2 z-10 text-center text-[11px] tabular-nums", tone === "dark" ? "text-white/45" : "text-black/40")}>
          {label}
        </p>
        <div ref={settingsRef} className="absolute bottom-1.5 right-1.5 z-20 flex flex-col-reverse items-end gap-2">
          <IconButton label="Book appearance" tone={tone} pressed={open} onClick={() => setOpen((v) => !v)}>
            <SlidersHorizontal className="size-[17px]" />
          </IconButton>
          {open && (
            <Panel label="Book appearance" className="w-[min(17rem,calc(100vw-1rem))] space-y-3">
              <div className="space-y-1.5">
                <p className="text-muted-foreground">Appearance</p>
                <Segmented label="Appearance" value={settings.studio ? "studio" : "simple"} options={[["simple", "Simple"], ["studio", "Studio"]] as const} onChange={(v) => update({ studio: v === "studio" })} />
              </div>
              {settings.studio && (
                <>
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground">Paper</p>
                    <Segmented label="Paper" value={settings.material === "textured" ? "textured" : "satin"} options={[["satin", "Satin"], ["textured", "Textured"]] as const} onChange={(v) => update({ material: v })} />
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-muted-foreground">Brightness</span>
                    <span className="flex items-center gap-2">
                      <input
                        type="range"
                        aria-label="Studio brightness"
                        className="min-w-0 flex-1 accent-foreground"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round(settings.brightness * 100)}
                        onChange={(e) => update({ brightness: Number(e.target.value) / 100 })}
                      />
                      <span className="w-9 text-right tabular-nums">{Math.round(settings.brightness * 100)}%</span>
                    </span>
                  </label>
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground">Lighting</p>
                    <div role="radiogroup" aria-label="Lighting" className="grid grid-cols-4 gap-1.5">
                      {HDRI_PRESETS.map((h, i) => (
                        <button
                          key={h.id}
                          type="button"
                          role="radio"
                          aria-checked={settings.hdri === h.id}
                          aria-label={`Lighting ${i + 1}`}
                          title={`Lighting ${i + 1}`}
                          onClick={() => update({ hdri: h.id })}
                          className={cn("relative h-12 overflow-hidden rounded-lg border text-sm font-medium text-white transition-opacity", settings.hdri === h.id ? "border-foreground opacity-100 ring-2 ring-foreground/30" : "border-border opacity-75 hover:opacity-100")}
                          style={{ background: h.preview }}
                        >
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{i + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </Panel>
          )}
        </div>
      </div>
    </section>
  );
}
