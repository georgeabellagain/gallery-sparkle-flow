import { loadNoteFonts, loadNoteImages, paintClosedNotes } from "@/lib/portfolia/foldout-paint";
import { foldoutSurfaces } from "@/lib/portfolia/foldouts";
import { StoredFoldout } from "./FoldoutCard";
import { getBookInset, subscribeBookInset } from "@/lib/portfolia/book-framing";
import { PageLinkAnchor } from "./PageLinks";
import { loadLinkIcons, paintPageLinks, type LinkIcons } from "@/lib/portfolia/link-paint";
import { PageTabButtons } from "./PageTabs";
import { planTabs, tabEdge } from "@/lib/portfolia/tab-geometry";
import { linksForLeaf, readablePageLinks, readablePageTags, tabSlots, type PageLink, type PageTag } from "@/lib/portfolia/page-extras";
import { foldoutsForLeaf, readableFoldouts, type Foldout, type PageBounds } from "@/lib/portfolia/foldouts";
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
import { createBookScene, type BookFaces, type BookScene, type StudioSettings } from "@/lib/portfolia/book-scene";
import { DEFAULT_SIMPLE_SHADOW_OPACITY } from "@/lib/portfolia/lighting";
import { getPreviewLook, subscribePreviewLook, type PreviewLook } from "@/lib/portfolia/preview-look";
import { coverThenSpreads, coverWithSpreads } from "@/lib/portfolia/mixed-layout";
import { useTouchGestures } from "@/components/pf/touch-gestures";
import { CPU_BYTES, deviceTier, detectDensity, longSideCap, longSideFor } from "@/lib/portfolia/resolution";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BackgroundFit } from "@/lib/portfolia/background";
import { BackdropLayer, IconButton, Segmented, type Tone } from "@/components/pf/viewer-ui";

/** How the book looks, as the creator set it up in the editor. */
/** Full screen is the visible height of the window, which on a phone changes as the address bar slides away. */
const FULL_HEIGHT = typeof CSS !== "undefined" && CSS.supports?.("height", "100dvh") ? "100dvh" : "100vh";

type Look = Pick<StudioSettings, "studio" | "material" | "brightness" | "hdri" | "simpleShadow" | "simpleShadowOpacity">;
const lookFrom = (viewer: ViewerSettings): Look => ({
  studio: viewer.look === "studio",
  material: viewer.finish === "textured" ? "textured" : "satin",
  brightness: viewer.studioBrightness ?? 0.5,
  hdri: viewer.studioLighting ?? "4",
  simpleShadow: viewer.simpleShadow ?? true,
  simpleShadowOpacity: viewer.simpleShadowOpacity ?? DEFAULT_SIMPLE_SHADOW_OPACITY,
});

/** The most turns that can be queued up by clicking quickly. */
const MAX_QUEUE = 12;


/**
 * Renders every page once into a ready-to-use face and keeps them in a bounded
 * cache. A turn then only hands existing canvases to the scene, with no
 * rendering or copying at the moment the page moves. Pages are rendered up
 * front, within a memory budget, so turning never waits.
 */
function pageLoader(
  doc: PDFDocumentProxy,
  ratio: number,
  layout: ReturnType<typeof bookLayout>,
  /** The detail of the images inside the PDF, in pixels per PDF point (0 if there are none). */
  density: Promise<number> = Promise.resolve(0),
  /** What the graphics card can take, known once the 3D view exists. */
  maxTexture: () => number = () => 4096,
  lightweight = false,
  notes: Foldout[] = [],
  links: PageLink[] = [],
) {
  const linkIcons: LinkIcons = new Map();
  const faces = new Map<number, HTMLCanvasElement>();
  const pending = new Map<number, Promise<void>>();
  const tasks = new Set<RenderTask>();
  let closed = false;
  let paused = false;
  let resumeWaiters: (() => void)[] = [];
  const resume = () => {
    const waiting = resumeWaiters;
    resumeWaiters = [];
    waiting.forEach((go) => go());
  };

  const leavesOf = new Map<number, number[]>();
  layout.leaves.forEach((leaf, index) => {
    const list = leavesOf.get(leaf.page);
    if (list) list.push(index);
    else leavesOf.set(leaf.page, [index]);
  });

  // Each page is drawn at the detail of the images inside the PDF, so nothing is softer than the file that was
  // uploaded (a spread sheet keeps the sheet's detail across both pages), and never below what the screen needs.
  // The most a device can safely hold caps it. Pages are kept in memory within that budget; any beyond it are
  // prepared just before they are turned to, and the turn waits for them.
  const split = layout.leaves.some((leaf) => leaf.half) ? 0.5 : 1;
  const perPage = split === 0.5 ? 2 : 1;
  const count = layout.leaves.length;
  const tier = deviceTier();
  const screenLong = lightweight ? 1600 : Math.min(4096, Math.max(2560, window.innerWidth * Math.min(devicePixelRatio || 1, 3)));
  const leafRatio = Math.max(ratio, 1 / ratio);
  const isSplit = (page: number) => (leavesOf.get(page) ?? []).some((index) => !!layout.leaves[index]!.half);
  /** The long side, in PDF points, of what is shown for this page (a whole page, or half of a spread). */
  const leafLongPt = (page: number, width: number, height: number) => Math.max(isSplit(page) ? width / 2 : width, height);
  let nativeDensity = 0;
  let keep = 8;
  const longFor = (page: number, width: number, height: number) =>
    longSideFor({
      screenLong,
      density: nativeDensity,
      leafLongPt: leafLongPt(page, width, height),
      cap: lightweight ? 1600 : longSideCap({ leafRatio, tier, maxTexture: maxTexture() }),
    });

  const plan = (async () => {
    nativeDensity = await density.catch(() => 0);
    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    const long = longFor(1, first.width, first.height);
    // Enough pages stay in memory to turn through the book; the rest are prepared as they are needed.
    keep = Math.max(6, Math.min(count, Math.floor(CPU_BYTES[tier] / ((4 * long * long) / leafRatio))));
  })();
  const compose = (raw: HTMLCanvasElement, leaf: Leaf, index: number, noteImages: Awaited<ReturnType<typeof loadNoteImages>>) => {
    const canvas = document.createElement("canvas");
    canvas.width = leaf.half ? Math.floor(raw.width / 2) : raw.width;
    canvas.height = Math.round(canvas.width * ratio);
    // Each page's position in the book gives it its own, repeatable imperfections.
    canvas.dataset["seed"] = String(index);
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
    paintClosedNotes(canvas, foldoutsForLeaf(notes, leaf), noteImages);
    // Links are printed on the page itself, so they curve, turn and catch the light with it.
    paintPageLinks(ctx, canvas.width, canvas.height, linksForLeaf(links, leaf), linkIcons);
    return canvas;
  };

  const render = (page: number): Promise<void> => {
    const existing = pending.get(page);
    if (existing) return existing;
    const promise = (async () => {
      await plan;
      const pdfPage = await doc.getPage(page);
      if (closed) throw new Error("Viewer closed");
      const original = pdfPage.getViewport({ scale: 1 });
      // The scale that gives one leaf (a whole page, or half of a spread) its long side, so a spread's two
      // halves together carry the whole sheet's detail.
      const viewport = pdfPage.getViewport({ scale: longFor(page, original.width, original.height) / leafLongPt(page, original.width, original.height) });
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
      await loadLinkIcons(links.filter((l) => l.page === page), linkIcons);
      await loadNoteFonts(notes.filter(f => f.page === page).map(f => foldoutSurfaces(f).outside));
      const images = await loadNoteImages(notes.filter(f => f.page === page).flatMap(f => { const key = foldoutSurfaces(f).outside.imageKey; return key ? [key] : []; }));
      try {
        if (closed) throw new Error("Viewer closed");
        for (const index of leavesOf.get(page) ?? []) faces.set(index, compose(raw, layout.leaves[index]!, index, images));
      } finally { images.forEach(image => image.close()); }
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
    async preload(onProgress: (done: number, total: number) => void): Promise<void> {
      await plan;
      const total = Math.min(doc.numPages, Math.floor(keep / perPage));
      // Turning waits until every page is ready, so no page ever has to be prepared during a turn.
      const gate = lightweight ? Math.min(2, total) : total;
      return new Promise<void>((resolve) => {
        let next = 1;
        let done = 0;
        const worker = async () => {
          while (!closed) {
            // Preparing pages uses the main thread, so it waits while a page is turning.
            while (paused && !closed) await new Promise<void>((go) => resumeWaiters.push(go));
            if (closed) return;
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
    /** Holds the background preparation while a page turns, and lets it carry on afterwards. */
    setPaused(value: boolean) {
      paused = value;
      if (!value) resume();
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
      resume();
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
  fullscreen,
  awake = true,
  onReadyChange,
  onRenderError,
  autoTurn = false,
  autoTurnDelay = 3200,
  fullSpread = false,
  previewable,
  demoNotes = false,
  lightweight = false,
  foldouts,
  tags,
  links,
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
  /** The viewer is full screen: the book fills the whole screen, top to bottom. */
  fullscreen?: boolean;
  /** Whether the on-screen icons are showing. In the full portfolio they appear only when the mouse moves. */
  awake?: boolean;
  /** Told when the book has rendered and is ready to show, and when it is preparing again. */
  onReadyChange?: (ready: boolean) => void;
  onRenderError?: (message: string) => void;
  /** Featured demo only; uses the normal animated turn path. */
  autoTurn?: boolean;
  autoTurnDelay?: number;
  /** Demo-only: keep both pages centred even in narrow containers. */
  fullSpread?: boolean;
  /** The editor's preview: it shows the look whose settings are being edited. */
  previewable?: boolean;
  demoNotes?: boolean;
  lightweight?: boolean;
  foldouts?: Foldout[];
  /** Coloured tabs on the edges of the book; each jumps to its page. */
  tags?: PageTag[];
  /** Website links placed on pages. */
  links?: PageLink[];
}) {
  // A portrait first page followed only by landscape pages is a front cover and then two-page spreads.
  // The flipbook shows it that way whatever "My PDF contains" says; the other reading modes are unaffected.
  const coverAndSpreads = useMemo(() => coverWithSpreads(sizes), [sizes]);
  const layout = useMemo(
    () => (coverAndSpreads ? coverThenSpreads(doc.numPages) : bookLayout(doc.numPages, viewer.spreads === "ready")),
    [doc, viewer.spreads, coverAndSpreads],
  );
  const first = sizes[coverAndSpreads ? 1 : 0] ?? { w: 1, h: 1.4 };
  const ratio = first.h / (coverAndSpreads || viewer.spreads === "ready" ? first.w / 2 : first.w);
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
  const [ready, setReady] = useState(0);
  const [warm, setWarm] = useState(false);
  const [warmProgress, setWarmProgress] = useState({ done: 0, total: 0 });
  const offersBoth = useRef(false);
  const [corners, setCorners] = useState([
    { x: 8, y: 86 },
    { x: 92, y: 86 },
  ]);
  const [pageBounds, setPageBounds] = useState<PageBounds[]>([]);
  const [tabRects, setTabRects] = useState<Array<{ id: string; x: number; y: number; width: number; height: number }>>([]);
  // Positions are only handed to React when they actually moved, so panning, zooming and turning do not re-render the whole book for nothing.
  const keep = <T,>(next: T) => (previous: T): T => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  const syncBounds = () => {
    const s = scene.current;
    if (!s) return;
    setCorners(keep(s.corners()));
    setPageBounds(keep(s.pageBounds()));
    setTabRects(keep(s.tabRects()));
  };
  const notesSignature = JSON.stringify(foldouts ?? []);
  const additions = useMemo(() => readableFoldouts(JSON.parse(notesSignature), doc.numPages), [notesSignature, doc.numPages]);
  const tagsSignature = JSON.stringify(tags ?? []);
  const linksSignature = JSON.stringify(links ?? []);
  const pageTags = useMemo(() => readablePageTags(JSON.parse(tagsSignature), doc.numPages), [tagsSignature, doc.numPages]);
  const pageLinks = useMemo(() => readablePageLinks(JSON.parse(linksSignature), doc.numPages), [linksSignature, doc.numPages]);
  const noteClosers = useRef(new Map<string, () => Promise<void> | null>());
  /**
   * Any open scrapbook note folds shut before the page turns away from it. Called before the book is marked busy
   * (which hides the notes), and holding the book's lock meanwhile so a quick click cannot start a second turn.
   */
  const closeNotes = useCallback(async () => {
    const closing = [...noteClosers.current.values()].map((close) => close()).filter((p): p is Promise<void> => !!p);
    if (!closing.length) return;
    const owned = !lock.current;
    lock.current = true;
    try {
      await Promise.all(closing);
    } finally {
      if (owned) lock.current = false;
    }
  }, []);
  const [leaf, setLeaf] = useState(0);
  const tagById = useMemo(() => new Map(pageTags.map((t) => [t.id, t])), [pageTags]);
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
  useEffect(() => {
    loader.current?.setPaused(busy);
  }, [busy]);
  const fallbackCanvas = useRef<HTMLCanvasElement>(null);
  // In the editor, the preview shows the look whose settings are being edited (only if that look is on offer).
  const [previewLook, setPreviewLook] = useState<PreviewLook | null>(() => (previewable ? getPreviewLook() : null));
  useEffect(() => {
    if (!previewable) return;
    setPreviewLook(getPreviewLook());
    return subscribePreviewLook(setPreviewLook);
  }, [previewable]);
  const offered = viewer.looks?.length ? viewer.looks : [viewer.look];
  const lookFor = (): Look => {
    const base = lookFrom(viewer);
    return previewLook && offered.includes(previewLook) ? { ...base, studio: previewLook === "studio" } : base;
  };
  const [settings, setSettings] = useState<Look>(lookFor);
  // When the creator changes the settings in the editor, the book follows. A visitor's own
  // Simple/Studio choice is kept until then.
  useEffect(() => {
    setSettings(lookFor());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.look, viewer.finish, viewer.studioBrightness, viewer.studioLighting, viewer.simpleShadow, viewer.simpleShadowOpacity, previewLook]);
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
  const tabEntries = useMemo(
    () =>
      tabSlots(pageTags).flatMap((t) => {
        const target = layout.leaves.findIndex((l) => l.page === t.page);
        return target < 0 ? [] : [{ ...t, leaf: target }];
      }),
    [pageTags, layout],
  );
  const currentTabs = new Set(tabEntries.filter((t) => (narrow ? t.leaf === leaf : spread.includes(t.leaf))).map((t) => t.id));
  /** How the tabs travel in a turn from one spread to another: with their own sheet, or hopping edge halfway. */
  const tabPlanFor = useCallback(
    (fromSpread: Array<number | null>, toSpread: Array<number | null>, dir: 1 | -1) =>
      tabEntries.length
        ? planTabs(tabEntries.map((t) => ({ id: t.id, leaf: t.leaf })), fromSpread, toSpread, [fromSpread[dir === 1 ? 1 : 0] ?? null, toSpread[dir === 1 ? 0 : 1] ?? null], narrow)
        : null,
    [tabEntries, narrow],
  );
  useEffect(() => {
    if (!ready || !scene.current) return;
    scene.current.setInset(getBookInset());
    const apply = (value: number) => { scene.current?.setInset(value); syncBounds(); };
    return subscribeBookInset(apply);
  }, [ready]);
  useEffect(() => {
    if (!ready || fallback || !scene.current) return;
    scene.current.setTabs(tabEntries.map((t) => ({ id: t.id, text: t.label || String(t.page), colour: t.colour })), narrow);
    scene.current.setTabRest(Object.fromEntries(tabEntries.map((t) => [t.id, tabEdge(t.leaf, spread, narrow)])));
    syncBounds();
  }, [ready, fallback, tabEntries, narrow]);
  useEffect(() => {
    if (!ready || fallback || busy || !scene.current || !tabEntries.length) return;
    scene.current.setTabRest(Object.fromEntries(tabEntries.map((t) => [t.id, tabEdge(t.leaf, spread, narrow)])));
    syncBounds();
  }, [leaf, busy]);
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
    const observer = new ResizeObserver(() => { setNarrow(!fullSpread && element.clientWidth < 720); requestAnimationFrame(syncBounds); });
    observer.observe(element);
    setNarrow(!fullSpread && element.clientWidth < 720);
    // The detail of the images inside the PDF is read once, in the background; pages wait for it before drawing.
    const density = lightweight ? Promise.resolve(0) : loadPdfjs().then((pdfjs) => detectDensity(doc, pdfjs.OPS as never)).catch(() => 0);
    const source = pageLoader(doc, ratio, layout, density, () => scene.current?.maxTextureSize ?? 4096, lightweight, additions, pageLinks);
    loader.current = source;
    setWarm(false);
    setWarmProgress({ done: 0, total: 0 });
    void source.preload((done, total) => {
      if (!cancelled) setWarmProgress({ done, total });
    }).then(async () => {
      // Pages are only part of it: both looks' shaders and the lighting are prepared too, so neither the first
      // turn nor the Simple/Studio switch has anything left to stall on. (A cap stops a slow download holding it up.)
      try {
        await Promise.race([scene.current?.prepare(offersBoth.current) ?? Promise.resolve(), new Promise<void>((done) => setTimeout(done, 8000))]);
      } catch {
        /* turning is allowed anyway */
      }
      if (!cancelled) setWarm(true);
    }).catch(() => { if (!cancelled) setError("The PDF pages could not be prepared. Please reload and try again."); });
    // 3D that keeps working. Failing to start, or the browser taking the graphics context back, is not the end
    // of 3D: a fresh view is built a moment later. Only after several failures is the plain page view shown
    // (and 3D is still retried in the background, and swapped back in as soon as it works).
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    let steadyTimer: ReturnType<typeof setTimeout> | null = null;
    const RETRY_MS = [400, 1500, 4000, 8000];
    const MAX_TRIES = 12;
    const discard = () => {
      const old = scene.current;
      scene.current = null;
      try {
        old?.dispose();
      } catch (error) {
        console.warn("[flipbook] Closing the old 3D view:", error);
      }
    };
    const failed = () => {
      attempt += 1;
      if (attempt >= 3) setFallback(true);
      if (attempt >= MAX_TRIES || cancelled) return;
      retryTimer = setTimeout(build, RETRY_MS[Math.min(attempt - 1, RETRY_MS.length - 1)]);
    };
    const lost = (which: BookScene | null) => {
      // An old, already-replaced view reporting late is not news.
      if (cancelled || !which || which !== scene.current) return;
      console.warn("[flipbook] The graphics context was lost; waiting a moment for the browser to give it back.");
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        restoreTimer = null;
        if (cancelled || which !== scene.current) return;
        console.warn("[flipbook] The graphics context was not given back; building a new 3D view.");
        discard();
        failed();
      }, 2500);
    };
    const restored = (which: BookScene | null) => {
      if (which !== scene.current || !restoreTimer) return;
      clearTimeout(restoreTimer);
      restoreTimer = null;
    };
    const build = () => {
      retryTimer = null;
      if (cancelled) return;
      let made: BookScene | null = null;
      try {
        made = createBookScene(element, ratio, () => lost(made), () => restored(made));
      } catch (error) {
        console.error(`[flipbook] 3D could not start (try ${attempt + 1}):`, error);
        failed();
        return;
      }
      scene.current = made;
      // A rebuilt view is prepared again (shaders, lighting) without holding anything up.
      void made.prepare(offersBoth.current).catch(() => undefined);
      setFallback(false);
      setReady((v) => v + 1);
      // Once it has held for a few seconds, earlier trouble is forgotten.
      if (steadyTimer) clearTimeout(steadyTimer);
      steadyTimer = setTimeout(() => {
        attempt = 0;
      }, 6000);
    };
    build();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (restoreTimer) clearTimeout(restoreTimer);
      if (steadyTimer) clearTimeout(steadyTimer);
      alive.current = false;
      queued.current = 0;
      generation.current++;
      observer.disconnect();
      source.dispose();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [doc, ratio, layout, lightweight, fullSpread, additions, pageLinks]);

  const faces = useCallback(
    async (value: Spread): Promise<BookFaces> => {
      return Promise.all(value.map((n) => loader.current!.face(n))) as Promise<BookFaces>;
    },
    [],
  );

  useEffect(() => {
    onPage(current.page);
  }, [current.page, onPage]);
  const handledJump = useRef<typeof jump>(null);
  useEffect(() => {
    // A contents selection during a turn waits for it to land, then runs once.
    if (!jump || jump === handledJump.current || busy || lock.current) return;
    const found = layout.leaves.findIndex((l) => l.page === jump.page);
    if (found >= 0) {
      queued.current = 0;
      handledJump.current = jump;
      goTo(found);
    }
  }, [jump, layout, goTo, busy]);
  useEffect(() => {
    scene.current?.configure(settings);
  }, [settings, ready]);
  useEffect(() => {
    if (!busy && scene.current) {
      // A wheel gesture that has not reached the parent yet owns the zoom.
      scene.current.viewport(narrow, zoomFrame.current ? wheelZoom.current : zoom, focus);
      syncBounds();
    }
    if (!zoomFrame.current) wheelZoom.current = zoom;
  }, [narrow, zoom, focus, busy, ready, settings]);

  // On a touch screen: tap the left or right of the book to turn that way, and pinch to zoom the book itself
  // (not the whole web page). While two fingers are down nothing else (a pan, a swipe) happens.
  const pinching = useRef(false);
  const applyPinch = (asked: number, x: number, y: number) => {
    if (busy || wait || !scene.current) return;
    pinching.current = true;
    const next = Math.min(3, Math.max(1, asked));
    if (Math.abs(next - wheelZoom.current) < 0.001) return;
    scene.current.zoomAt(next, x, y);
    wheelZoom.current = next;
    if (!zoomFrame.current) {
      zoomFrame.current = requestAnimationFrame(() => {
        zoomFrame.current = 0;
        onZoomChange(wheelZoom.current);
        if (scene.current) syncBounds();
      });
    }
  };
  useTouchGestures(viewportRef, {
    enabled: !fallback,
    zoom: () => wheelZoom.current,
    onTap: (side) => {
      // Like the arrows, a tap while a page is still turning joins the queue; only while the book is preparing is it ignored.
      if (wait) return;
      if (side === "left") void move(-1);
      else if (side === "right") void move(1);
    },
    onPinch: applyPinch,
    onPinchEnd: () => {
      pinching.current = false;
    },
  });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || fallback) return;
    const onWheel = (event: WheelEvent) => {
      if (busy || wait || !scene.current) return;
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const next = Math.min(3, Math.max(1, wheelZoom.current * Math.exp(-dy * 0.0015)));
      if (Math.abs(next - wheelZoom.current) < 0.001) return;
      const rect = element.getBoundingClientRect();
      scene.current.zoomAt(next, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
      wheelZoom.current = next;
      // Tell React once per frame instead of on every wheel tick.
      if (!zoomFrame.current) {
        zoomFrame.current = requestAnimationFrame(() => {
          zoomFrame.current = 0;
          onZoomChange(wheelZoom.current);
          if (scene.current) syncBounds();
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
    if (!ready && !fallback) return;
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
    // The next spread first (most likely), then the previous, then the one after: all on the card before they are needed.
    const targets = [index + 1, index - 1, index + 2]
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
      timer = setTimeout(() => void step(), 45);
    };
    timer = setTimeout(() => void step(), 40);
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
      await closeNotes();
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
          else await scene.current.turn(from, to, direction, target, quick ? 0.5 : 1, tabPlanFor(fromSpread, nextSpread, direction));
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
    [wait, narrow, layout, faces, fallback, onZoomChange, ready, goTo, closeNotes, tabPlanFor],
  );

  /** Goes straight to the spread holding a page (used by the page tabs) with one smooth turn. */
  const jumpTo = useCallback(
    async (targetLeaf: number) => {
      if (wait || lock.current || targetLeaf < 0 || targetLeaf >= layout.leaves.length) return;
      await closeNotes();
      if (lock.current) return;
      const fromLeaf = leafRef.current;
      const fromIndex = spreadIndex(layout.spreads, fromLeaf);
      const toIndex = spreadIndex(layout.spreads, targetLeaf);
      if (narrow ? targetLeaf === fromLeaf : toIndex === fromIndex) return;
      const direction: 1 | -1 = (narrow ? targetLeaf > fromLeaf : toIndex > fromIndex) ? 1 : -1;
      const fromSpread = layout.spreads[fromIndex]!;
      const nextSpread = layout.spreads[toIndex]!;
      const nextLeaf = narrow ? targetLeaf : nextSpread.includes(targetLeaf) ? targetLeaf : nextSpread.find((n) => n !== null)!;
      const target = bookFocus(nextSpread, nextLeaf, narrow);
      queued.current = 0;
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
          if (fromIndex === toIndex) await scene.current.pan(target, 300);
          else await scene.current.turn(from, to, direction, target, 0.6, tabPlanFor(fromSpread, nextSpread, direction));
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
    [wait, narrow, layout, faces, fallback, onZoomChange, ready, goTo, closeNotes, tabPlanFor],
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

  /** A press on the page edge while a note is open: the note closes first, then a plain click turns the page. */
  const afterClose = useRef<{ id: number; x: number; y: number; dir: 1 | -1 } | null>(null);
  const beginCornerDrag = (e: React.PointerEvent<HTMLButtonElement>, direction: 1 | -1) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (!lock.current && !wait && [...noteClosers.current.values()].some((close) => close() !== null)) {
      e.preventDefault();
      afterClose.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: direction };
      void closeNotes();
      return;
    }
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
      await scene.current.prepareTurn(from, to, direction, target, 1, tabPlanFor(fromSpread, nextSpread, direction));
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
      const target = e.target instanceof Element ? e.target : null;
      // Typing and sliders keep their arrow keys. Buttons do not use them, and after clicking an icon (full screen,
      // zoom...) focus stays on that button, so buttons must not switch the arrow keys off.
      if (target?.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Page Up / Page Down also scroll the page, so they belong to the viewer only when it fills the screen.
      const pageKeys = !!immersive || !!fullscreen;
      if (e.key === "ArrowRight" || (pageKeys && e.key === "PageDown")) {
        e.preventDefault();
        void move(1);
      }
      if (e.key === "ArrowLeft" || (pageKeys && e.key === "PageUp")) {
        e.preventDefault();
        void move(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move, immersive, fullscreen]);
  const enabledLooks = viewer.looks?.length ? viewer.looks : [viewer.look];
  offersBoth.current = enabledLooks.length > 1;
  const updateLook = (look: "clean" | "studio") => setSettings((current) => ({ ...current, studio: look === "studio" }));

  // Tell the viewer when the book is rendered and ready, so it can show nothing but a loader until then.
  useEffect(() => { if (error) onRenderError?.(error); }, [error, onRenderError]);
  const bookReady = (ready > 0 || fallback) && warm && !loading && !error;
  const [litNotesKey, setLitNotesKey] = useState("");
  const notesKey = JSON.stringify([ready,spread,narrow,leaf,additions,bookReady,busy,wait,fallback]);
  useEffect(() => {
    const renderer = scene.current;
    if (!renderer) return;
    let cancelled = false;
    setLitNotesKey("");
    if (!bookReady || busy || wait || fallback) { renderer.clearNotes(); return; }
    const visible = spread.flatMap((n,side) => n === null || (narrow && n !== leaf) ? [] : foldoutsForLeaf(additions,layout.leaves[n]!).map(item=>({item,side})));
    void renderer.setNotes(visible).then(()=>{if(!cancelled)setLitNotesKey(notesKey);});
    return ()=>{cancelled=true;renderer.clearNotes();};
  }, [notesKey]);

  useEffect(() => {
    onReadyChange?.(bookReady);
  }, [bookReady, onReadyChange]);

  const autoDirection = useRef<1 | -1>(1);
  useEffect(() => {
    if (!autoTurn || !bookReady || busy || wait || error || (atStart && atEnd)) return;
    if (atEnd) autoDirection.current = -1;
    else if (atStart) autoDirection.current = 1;
    const timer = setTimeout(() => { void move(autoDirection.current); }, Math.max(800, autoTurnDelay));
    return () => clearTimeout(timer);
  }, [autoTurn, autoTurnDelay, bookReady, busy, wait, error, atStart, atEnd, move]);

  return (
    <section aria-label="Interactive PDF book" data-look={settings.studio ? "studio" : "simple"}>
      <div
        ref={viewportRef}
        className="pf-book-viewport"
        style={{ ...(fullscreen ? { height: FULL_HEIGHT } : immersive ? { height: "max(420px, 100svh)" } : {}), touchAction: zoom > 1 ? "none" : "pan-y" }}
        data-busy={busy || wait}
        data-narrow={narrow}
        data-panning={panning.current !== null}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && e.target !== host.current && e.target !== host.current?.firstChild) return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (!e.isPrimary || pinching.current) return;
          if (zoom <= 1 || busy || wait || !scene.current) return;
          panning.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const pan = panning.current;
          if (!pan || pan.id !== e.pointerId || pinching.current) return;
          // The scene keeps the view inside the initial framing.
          scene.current?.dragPan(e.clientX - pan.x, e.clientY - pan.y);
          pan.x = e.clientX;
          pan.y = e.clientY;
          if (scene.current) syncBounds();
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
        <div ref={host} className={cn("pf-book-canvas", (fallback || !bookReady) && "invisible")} />
        {fallback && (
          <div className={cn("pf-book-fallback", !bookReady && "invisible")}>
            <canvas ref={fallbackCanvas} />
            <p>3D is unavailable on this device. You can still read every page.</p>
          </div>
        )}
        {bookReady && !busy && !wait && !fallback && spread.map((n, side) => {
          const bounds = pageBounds[side];
          if (n === null || !bounds || (narrow && n !== leaf)) return null;
          const visible = foldoutsForLeaf(additions, layout.leaves[n]!);
          const onLeaf = linksForLeaf(pageLinks, layout.leaves[n]!);
          return <div key={`${n}:${settings.studio}`} className="pointer-events-none absolute z-30" style={{ left: `${bounds.x}%`, top: `${bounds.y}%`, width: `${bounds.width}%`, height: `${bounds.height}%` }}>
            {onLeaf.map(link => <PageLinkAnchor key={link.id} link={link} />)}
            {visible.map(item => <StoredFoldout key={`${item.id}:${litNotesKey === notesKey}:${JSON.stringify(item)}`} item={item} demoAnimate={demoNotes} baked sceneRendered={litNotesKey === notesKey} onProgress={p=>scene.current?.noteProgress(item.id,p)} closers={noteClosers} />)}
          </div>;
        })}
        {bookReady && !fallback && tabRects.length > 0 && (
          <PageTabButtons
            rects={tabRects}
            tags={tagById}
            current={currentTabs}
            disabled={busy || wait}
            onGo={(page) => void jumpTo(layout.leaves.findIndex((l) => l.page === page))}
          />
        )}
        {/* Each full page side turns at normal zoom; zoomed pages keep drag-to-pan. */}
        {!narrow &&
          !fallback &&
          zoom <= 1 &&
          (
            [
              [-1, "left"],
              [1, "right"],
            ] as const
          ).map(([d, side]) => (
            <Button
              key={side}
              type="button"
              variant="ghost"
              className="absolute z-10 cursor-grab touch-none rounded-none border-0 bg-transparent p-0 shadow-none hover:bg-transparent active:cursor-grabbing"
              style={{
                left: `${side === "left" ? (corners[0]?.x ?? 8) : ((corners[0]?.x ?? 8) + (corners[1]?.x ?? 92)) / 2}%`,
                top: `${100 - (corners[0]?.y ?? 86)}%`,
                width: `${((corners[1]?.x ?? 92) - (corners[0]?.x ?? 8)) / 2}%`,
                height: `${Math.max(0, 2 * (corners[0]?.y ?? 86) - 100)}%`,
              }}
              aria-label={d === 1 ? "Turn to next page" : "Turn to previous page"}
              disabled={wait || (d === 1 ? atEnd : atStart)}
              onPointerDown={(e) => beginCornerDrag(e, d)}
              onPointerMove={(e) => {
                const gesture = drag.current;
                if (!gesture || gesture.id !== e.pointerId) return;
                if (Math.abs(e.clientX - gesture.x) > 4 || Math.abs(e.clientY - gesture.y) > 4) gesture.moved = true;
                const width = e.currentTarget.clientWidth || 1;
                gesture.progress = Math.min(1, Math.max(0, gesture.dir * (gesture.x - e.clientX) / width));
                scene.current?.dragTurn(gesture.progress);
              }}
              onPointerUp={(e) => {
                const pending = afterClose.current;
                if (pending && pending.id === e.pointerId) {
                  afterClose.current = null;
                  if (Math.abs(e.clientX - pending.x) < 6 && Math.abs(e.clientY - pending.y) < 6) void move(pending.dir);
                  return;
                }
                void finishCornerDrag(e);
              }}
              onPointerCancel={(e) => void finishCornerDrag(e, true)}
              onClick={(e) => { if (e.detail === 0) void move(d); }}
            />
          ))}
        {wait && !error && (
          <p className="pf-book-status" role="status">
            Preparing pages…{warmProgress.total > 0 ? ` ${warmProgress.done} / ${warmProgress.total}` : ""}
          </p>
        )}
        {error && (
          <p className="pf-book-status" role="alert">
            {error}
          </p>
        )}
        <div className={cn("pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-1.5 transition-opacity duration-300", awake ? "opacity-100" : "opacity-0")}>
          <IconButton label="Previous page" tone={tone} large className={cn(awake ? "pointer-events-auto" : "pointer-events-none")} disabled={wait || atStart} onClick={() => void move(-1)}>
            <ChevronLeft className="size-6" />
          </IconButton>
        </div>
        <div className={cn("pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-1.5 transition-opacity duration-300", awake ? "opacity-100" : "opacity-0")}>
          <IconButton label="Next page" tone={tone} large className={cn(awake ? "pointer-events-auto" : "pointer-events-none")} disabled={wait || atEnd} onClick={() => void move(1)}>
            <ChevronRight className="size-6" />
          </IconButton>
        </div>
        <p aria-live="polite" className={cn("pointer-events-none absolute inset-x-0 bottom-5 z-10 text-center text-[11px] tabular-nums transition-opacity duration-300", awake ? "opacity-100" : "opacity-0", tone === "dark" ? "text-white/45" : "text-black/40")}>
          {label}
        </p>
        {/* Simple / Studio: only offered when the creator has enabled both. Everything else is set in the editor. */}
        {enabledLooks.length > 1 && (
          <div className={cn("absolute bottom-1.5 right-1.5 z-20 w-36 rounded-full bg-background/90 shadow-soft backdrop-blur transition-opacity duration-300", awake ? "opacity-100" : "pointer-events-none opacity-0")}>
            <Segmented label="Book appearance" value={settings.studio ? "studio" : "clean"} options={[["clean", "Simple"], ["studio", "Studio"]] as const} onChange={updateLook} />
          </div>
        )}
      </div>
    </section>
  );
}
