import { takePreviewTurn, subscribePreviewTurn } from "@/lib/portfolia/preview-turn";
import { ribbonGutterFor } from "@/lib/portfolia/book-details";
import { coverLeaf } from "@/lib/portfolia/rigid-cover";
import { createPreparationGate } from "@/lib/portfolia/preparation-gate";
import { LiveScrapbookContext } from "./live-scrapbook-context";
import { LiveScrapbookPage } from "./LiveScrapbookPage";
import { HomeScrollContext, releaseHomeScroll } from "./home-scroll";
import { captureFrames } from "@/lib/portfolia/turn-motion";
import { canvasStill, recordStudioClip } from "@/lib/portfolia/studio-recorder";
import type { StudioExporter, RenderedState, RenderHotspot } from "@/lib/portfolia/rendered-studio";
import { loadNoteFonts, loadNoteImages, paintClosedNotes } from "@/lib/portfolia/foldout-paint";
import { foldoutSurfaces } from "@/lib/portfolia/foldouts";
import { StoredFoldout } from "./FoldoutCard";
import { BookLoader } from "./book-loader";
import { getBookInset, subscribeBookInset } from "@/lib/portfolia/book-framing";
import { PageStickerMark } from "./AnimatedSticker";
import { drawPageLayer, loadPageLayerPictures } from "./sticker-layer";
import { PageHotspotMark } from "./PageHotspots";
import { PageSlideshowMark } from "./PageSlideshow";
import { PageJumpLink, PageLinkAnchor } from "./PageLinks";
import { isBackgroundScene } from "@/lib/portfolia/background-scenes";
import { loadLinkIcons, paintPageLinks, type LinkIcons } from "@/lib/portfolia/link-paint";
import { PageTabButtons } from "./PageTabs";
import { planTabs, tabEdge } from "@/lib/portfolia/tab-geometry";
import { videoThumbnail, hotspotHeight, jumpsForLeaf, linksForLeaf, readablePageJumps, readablePageStickers, stickersForLeaf, readablePageHotspots, hotspotsForLeaf, type PageHotspot, readablePageSlideshows, slideshowsForLeaf, type PageSlideshow, type PageSticker, readablePageLinks, readablePageSpotlights, readablePageTags, readablePageVideos, spotlightRegion, spotlightsForLeaf, tabSlots, videosForLeaf, type PageJump, type PageLink, type PageSpotlight, type PageTag, type PageVideo } from "@/lib/portfolia/page-extras";
import { SpotlightLightbox, SpotlightTarget, type SpotlightView } from "./PageSpotlights";
import { getBlob, publicAssetUrl, resolveAssetUrl } from "@/lib/portfolia/assets";
import { videoUvRect } from "@/lib/portfolia/page-video";
import { createPageVideoPlayer, type PageVideoPlayer } from "@/lib/portfolia/page-video-player";
import { PageVideoSound } from "./PageVideoSound";
import { foldoutsForLeaf, readableFoldouts, type Foldout, type PageBounds } from "@/lib/portfolia/foldouts";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Rotate3d } from "lucide-react";
import { orbitDrag, type Orbit } from "@/lib/portfolia/orbit-view";
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
import { DEFAULT_SIMPLE_SHADOW_OPACITY, type HdriId } from "@/lib/portfolia/lighting";
import { getPreviewLook, subscribePreviewLook, type PreviewLook } from "@/lib/portfolia/preview-look";
import { coverThenSpreads, coverWithSpreads } from "@/lib/portfolia/mixed-layout";
import { useTouchGestures } from "@/components/pf/touch-gestures";
import { CPU_BYTES, deviceTier, detectDensity, longSideCap, longSideFor } from "@/lib/portfolia/resolution";
import { isStreamedPdf } from "@/lib/portfolia/remote-pdf";
import { isPageImageDocument, pageImageBitmap, pictureDensity } from "@/lib/portfolia/page-image-doc";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BackgroundFit } from "@/lib/portfolia/background";
import { BackdropLayer, IconButton, Segmented, type Tone } from "@/components/pf/viewer-ui";

/** How the book looks, as the creator set it up in the editor. */
/** Full screen is the visible height of the window, which on a phone changes as the address bar slides away. */
const FULL_HEIGHT = typeof CSS !== "undefined" && CSS.supports?.("height", "100dvh") ? "100dvh" : "100vh";

type Look = Pick<StudioSettings, "studio" | "material" | "brightness" | "hdri" | "simpleShadow" | "simpleShadowOpacity" | "shadeStyle" | "tabStyle" | "strength" | "textureStrength" | "topLight" | "imperfections" | "turnStyle" | "turnSpeed" | "turnCurve" | "bookStyle" | "pageStack" | "ribbon" | "ribbonColour" | "ribbonGutter">;
const lookFrom = (viewer: ViewerSettings): Look => ({
  studio: viewer.look === "studio",
  turnStyle: viewer.turnStyle,
  turnSpeed: viewer.turnSpeed,
  turnCurve: viewer.turnCurve,
  bookStyle: viewer.bookStyle,
  pageStack: viewer.pageStack === true,
  // The ribbon bookmark is set aside for now (its saved settings are kept for when it returns).
  ribbon: false,
  ribbonColour: viewer.ribbonColour,
  material: viewer.finish,
  strength: viewer.studioLightingStrength ?? .75,
  textureStrength: 1,
  brightness: viewer.studioBrightness ?? 0.5,
  topLight: viewer.studioTopLight ?? 0,
  imperfections: viewer.studioImperfections ?? false,
  hdri: viewer.studioLighting ?? "4",
  simpleShadow: viewer.simpleShadow ?? true,
  simpleShadowOpacity: viewer.simpleShadowOpacity ?? DEFAULT_SIMPLE_SHADOW_OPACITY,
  shadeStyle: viewer.simpleShading,
  tabStyle: viewer.tabStyle,
});

/** The most turns that can be queued up by clicking quickly. */
const MAX_QUEUE = 12;
/** Page faces kept decoded for a book drawn from page pictures: the open spread, the ones either side, and spare. */
const PICTURE_FACES = 10;


/**
 * Prepares nearby pages into a bounded face cache. Later pages continue in the
 * background. A turn waits for its target artwork before starting, so PDF
 * rendering never happens during the page movement itself.
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
  previewTextureCap = 1600,
  videos: PageVideo[] = [],
  hotspots: PageHotspot[] = [],
) {
  const linkIcons: LinkIcons = new Map();
  /** Each video's still, printed into its box: what shows before it plays, where motion is off, and in captures. */
  const loadPosters = async (page: number) => {
    const out = new Map<string, ImageBitmap>();
    await Promise.all(videos.filter((v) => v.page === page).map(async (v) => {
      try { const blob = await getBlob(v.posterKey); if (blob) out.set(v.id, await createImageBitmap(blob)); } catch { /* the box stays dark until the video plays */ }
    }));
    await Promise.all(hotspots.filter(h => h.page === page && h.style === "video").map(async h => {
      const url = h.video && videoThumbnail(h.video);
      if (!url) return;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2500), mode: "cors" });
        if (response.ok) out.set("embed:" + h.id, await createImageBitmap(await response.blob()));
      } catch { /* Blocked thumbnails must never prevent opening the book. */ }
    }));
    return out;
  };
  const faces = new Map<number, HTMLCanvasElement>();
  const pending = new Map<number, Promise<void>>();
  const tasks = new Set<RenderTask>();
  let closed = false;
  let paused = false;
  const preparation = createPreparationGate<number>();
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
  const screenLong = lightweight
    ? previewTextureCap
    : tier === "phone"
      ? Math.min(1600, Math.max(1200, window.innerWidth * Math.min(devicePixelRatio || 1, 3)))
      : Math.min(4096, Math.max(2560, window.innerWidth * Math.min(devicePixelRatio || 1, 3)));
  const leafRatio = Math.max(ratio, 1 / ratio);
  const isSplit = (page: number) => (leavesOf.get(page) ?? []).some((index) => !!layout.leaves[index]!.half);
  /** The long side, in PDF points, of what is shown for this page (a whole page, or half of a spread). */
  const leafLongPt = (page: number, width: number, height: number) => Math.max(isSplit(page) ? width / 2 : width, height);
  let nativeDensity = 0;
  let keep = 8;
  // Pages drawn from pictures made at publishing cannot hold more detail than those pictures, so a large screen
  // never spends memory on enlarging them.
  const pictures = isPageImageDocument(doc);
  const longFor = (page: number, width: number, height: number) => {
    const long = longSideFor({
      screenLong,
      density: nativeDensity,
      leafLongPt: leafLongPt(page, width, height),
      cap: lightweight ? previewTextureCap : Math.min(tier === "phone" ? 1600 : Infinity, longSideCap({ leafRatio, tier, maxTexture: maxTexture() })),
    });
    const detail = pictures ? pictureDensity(doc, page) : undefined;
    return detail ? Math.min(long, Math.max(1, Math.round(detail * leafLongPt(page, width, height)))) : long;
  };

  const plan = (async () => {
    nativeDensity = await density.catch(() => 0);
    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    const long = longFor(1, first.width, first.height);
    // Enough pages stay in memory to turn through the book; the rest are prepared as they are needed.
    keep = Math.max(6, Math.min(count, Math.floor(CPU_BYTES[tier] / ((4 * long * long) / leafRatio))));
    // A page made from a picture is decoded again from its small file in milliseconds, so only the spreads
    // around the reader stay decoded in memory; PDF pages are slow to draw and keep the larger budget.
    if (pictures) keep = Math.min(keep, PICTURE_FACES);
  })();
  const compose = (raw: HTMLCanvasElement | ImageBitmap, leaf: Leaf, index: number, noteImages: Awaited<ReturnType<typeof loadNoteImages>>, posters: Map<string, ImageBitmap>) => {
    const canvas = document.createElement("canvas");
    canvas.width = leaf.half ? Math.floor(raw.width / 2) : raw.width;
    canvas.height = Math.round(canvas.width * ratio);
    // Each page's position in the book gives it its own, repeatable imperfections.
    canvas.dataset["seed"] = String(index);
    canvas.dataset["coverBoard"] = String(coverLeaf(index,layout.leaves.length));
    canvas.dataset["leafCount"] = String(layout.leaves.length);
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
    for (const v of videosForLeaf(videos, leaf)) {
      const poster = posters.get(v.id);
      ctx.fillStyle = "#111";
      ctx.fillRect(v.x * canvas.width, v.y * canvas.height, v.width * canvas.width, v.height * canvas.height);
      if (poster) ctx.drawImage(poster, v.x * canvas.width, v.y * canvas.height, v.width * canvas.width, v.height * canvas.height);
    }
    for (const h of hotspotsForLeaf(hotspots, leaf).filter(h => h.style === "video")) {
      const poster = posters.get("embed:" + h.id);
      const x = h.x * canvas.width, y = h.y * canvas.height, w = h.size * canvas.width, height = hotspotHeight(h, ratio) * canvas.height;
      ctx.fillStyle = "#1e293b"; ctx.fillRect(x, y, w, height);
      if (poster) {
        const crop = Math.min(poster.width / w, poster.height / height);
        const sw = w * crop, sh = height * crop;
        ctx.drawImage(poster, (poster.width - sw) / 2, (poster.height - sh) / 2, sw, sh, x, y, w, height);
      }
    }
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
      const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
      // A picture is decoded straight to its final size off the main thread and the faces are composed from it:
      // no full-size drawing canvas, and nothing for pdf.js to do.
      let raw: HTMLCanvasElement | ImageBitmap | null = pictures ? ((await pageImageBitmap(doc, page, width, height)?.catch(() => null)) ?? null) : null;
      if (closed) { if (raw instanceof ImageBitmap) raw.close(); throw new Error("Viewer closed"); }
      if (!raw) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const task = pdfPage.render({ canvasContext: canvas.getContext("2d")!, viewport });
        // PDF.js yields between chunks. Hold speculative chunks during motion;
        // a face explicitly requested by navigation bypasses the hold.
        task.onContinue = (continuation: () => void) => preparation.schedule(page, () => { if (!closed) continuation(); });
        tasks.add(task);
        try {
          await task.promise;
        } finally {
          tasks.delete(task);
        }
        raw = canvas;
      }
      if (closed) throw new Error("Viewer closed");
      const source = raw;
      const [, , images, posters] = await Promise.all([
        loadLinkIcons(links.filter((l) => l.page === page), linkIcons),
        loadNoteFonts(notes.filter(f => f.page === page).map(f => foldoutSurfaces(f).outside)),
        loadNoteImages(notes.filter(f => f.page === page).flatMap(f => { const key = foldoutSurfaces(f).outside.imageKey; return key ? [key] : []; })),
        loadPosters(page),
      ]);
      try {
        await new Promise<void>(resolve => preparation.schedule(page, resolve));
        if (closed) throw new Error("Viewer closed");
        for (const index of leavesOf.get(page) ?? []) faces.set(index, compose(source, layout.leaves[index]!, index, images, posters));
      } finally {
        images.forEach(image => image.close()); posters.forEach(image => image.close());
        // The faces hold the pixels now; release the full-size render straight away.
        if (source instanceof HTMLCanvasElement) source.width = source.height = 0;
        else source.close();
      }
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
      // A streamed PDF prepares only the next couple of spreads ahead; later pages download as the reader nears them.
      const total = Math.min(doc.numPages, Math.floor(keep / perPage), isStreamedPdf(doc) ? 7 : Infinity);
      // Open on a prepared cover/nearby spread; remaining work continues and pauses during turns.
      const gate = Math.min(lightweight ? 2 : 3, total);
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
      preparation.setPaused(value);
      if (!value) resume();
    },
    async face(index: number | null): Promise<HTMLCanvasElement | null> {
      if (index === null) return null;
      let hit = faces.get(index);
      if (!hit) {
        const page = layout.leaves[index]!.page;
        const release = preparation.prioritize(page);
        try { await render(page); } finally { release(); }
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
      preparation.close();
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
  onDemoReady,
  onPreviewReady,
  onRenderError,
  autoTurn = false,
  autoTurnDelay = 3200,
  fullSpread = false,
  previewable,
  onLookChange,
  demoNotes = false,
  demoTurnDurationScale = 1,
  demoLightingCycle,
  lightweight = false,
  previewTextureCap = 1600,
  frameAspect,
  captureQuality = false,
  onExporter,
  foldouts,
  tags,
  links,
  videos,
  spotlights,
  jumps,
  stickers,
  hotspots,
  slideshows,
  visiblePages,
  showPageNumber = true,
  showNavigation = true,
  showAppearance = true,
  showcaseOrbit = false,
  showcaseOrbitStart,
  presentationActive = true,
  loadingIndicator = true,
}: {
  doc: PDFDocumentProxy;
  sizes: { w: number; h: number }[];
  zoom: number;
  onZoomChange: (zoom: number) => void;
  jump: { page: number; t: number } | null;
  onPage: (page: number) => void;
  showPageNumber?: boolean;
  showNavigation?: boolean;
  showAppearance?: boolean;
  /** Homepage only: drift slowly round the book in 3D until the reader takes over. */
  showcaseOrbit?: boolean;
  showcaseOrbitStart?: number;
  presentationActive?: boolean;
  /** A parent reader/demo may own the single loading indicator. */
  loadingIndicator?: boolean;
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
  /** Homepage only: final lighting, backdrop, shaders and a painted frame. */
  onDemoReady?: () => void;
  /** The initial 3D introduction has settled and its frame has been painted. */
  onPreviewReady?: () => void;
  onRenderError?: (message: string) => void;
  /** Featured demo only; uses the normal animated turn path. */
  autoTurn?: boolean;
  autoTurnDelay?: number;
  /** Demo-only: keep both pages centred even in narrow containers. */
  fullSpread?: boolean;
  /** The editor's preview: it shows the look whose settings are being edited. */
  previewable?: boolean;
  onLookChange?: (look: "clean" | "studio") => void;
  demoNotes?: boolean;
  /** Presentation-only timing; normal readers retain their existing pace. */
  demoTurnDurationScale?: number;
  /** Presentation-only: prepare every environment used by a lighting loop. */
  demoLightingCycle?: readonly HdriId[];
  lightweight?: boolean;
  /** Small showcase-only textures; normal portfolio artwork is unchanged. */
  previewTextureCap?: number;
  /** Offline feature recording keeps the drawing surface at its original resolution. */
  frameAspect?: number;
  captureQuality?: boolean;
  onExporter?: (exporter: StudioExporter | null) => void;
  foldouts?: Foldout[];
  /** Coloured tabs on the edges of the book; each jumps to its page. */
  tags?: PageTag[];
  /** Website links placed on pages. */
  links?: PageLink[];
  /** Videos printed on pages (Personal; already removed for unpaid owners). */
  videos?: PageVideo[];
  /** Details readers can open large. */
  spotlights?: PageSpotlight[];
  /** Contents links: boxes that turn straight to another page. */
  jumps?: PageJump[];
  /** Small animated stickers on pages. */
  stickers?: PageSticker[];
  /** Pressable hotspots: product tags, pop-up cards, buttons. */
  hotspots?: PageHotspot[];
  /** Picture slideshows on pages. */
  slideshows?: PageSlideshow[];
  /** The pages readers see, when some are hidden; omitted, every page is in the book. */
  visiblePages?: number[];
}) {
  // A portrait first page followed only by landscape pages is a front cover and then two-page spreads.
  // The flipbook shows it that way whatever "My PDF contains" says; the other reading modes are unaffected.
  const coverAndSpreads = useMemo(() => coverWithSpreads(sizes), [sizes]);
  const layout = useMemo(
    () => (coverAndSpreads ? coverThenSpreads(doc.numPages, visiblePages) : bookLayout(doc.numPages, viewer.spreads === "ready", visiblePages)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, viewer.spreads, coverAndSpreads, visiblePages?.join()],
  );
  const first = sizes[coverAndSpreads ? 1 : 0] ?? { w: 1, h: 1.4 };
  const ratio = first.h / (coverAndSpreads || viewer.spreads === "ready" ? first.w / 2 : first.w);
  const host = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [automaticMotion, setAutomaticMotion] = useState(false);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let visible = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAutomaticMotion(presentationActive && visible && !document.hidden && !reduced.matches);
    const observer = new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); update(); });
    observer.observe(viewport);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    update();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); reduced.removeEventListener("change", update); };
  }, [presentationActive]);
  const wheelZoom = useRef(zoom);
  const zoomFrame = useRef(0);
  const scene = useRef<BookScene | null>(null);
  const loader = useRef<ReturnType<typeof pageLoader> | null>(null);
  const homeScroll = useContext(HomeScrollContext);
  const lock = useRef(false);
  const queued = useRef(0);
  /** The page tab journey in progress, if any; its target can change on the way. */
  const jumping = useRef<{ target: number } | null>(null);
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
  /** Sticker layers drawn so far (one per page face with stickers), redrawn while they ride on turning paper. */
  const pageLayers = useRef<Array<{ canvas: HTMLCanvasElement; stickers: PageSticker[]; slides: PageSlideshow[] }>>([]);
  /** The outer page corner the mouse rests near (it lifts slightly), if any. */
  const [peek, setPeek] = useState<{ side: 1 | -1; corner: "top" | "bottom" } | null>(null);
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
  const liveScrapbook = useContext(LiveScrapbookContext);
  const editingExtras = Boolean(liveScrapbook?.enabled);
  const notesSignature = JSON.stringify(editingExtras ? [] : foldouts ?? []);
  const additions = useMemo(() => readableFoldouts(JSON.parse(notesSignature), doc.numPages), [notesSignature, doc.numPages]);
  const tagsSignature = JSON.stringify(editingExtras ? [] : tags ?? []);
  const linksSignature = JSON.stringify(editingExtras ? [] : links ?? []);
  const pageTags = useMemo(() => readablePageTags(JSON.parse(tagsSignature), doc.numPages), [tagsSignature, doc.numPages]);
  const pageLinks = useMemo(() => readablePageLinks(JSON.parse(linksSignature), doc.numPages), [linksSignature, doc.numPages]);
  // While editing, the live editor shows each video's still on top; the book itself stays plain.
  const videosSignature = JSON.stringify(editingExtras ? [] : videos ?? []);
  const pageVideos = useMemo(() => readablePageVideos(JSON.parse(videosSignature), doc.numPages), [videosSignature, doc.numPages]);
  const spotlightsSignature = JSON.stringify(editingExtras ? [] : spotlights ?? []);
  // In portfolio order, each mapped onto its full PDF page (a spread sheet's halves are separate leaves).
  const spotlightViews = useMemo<SpotlightView[]>(() => readablePageSpotlights(JSON.parse(spotlightsSignature), doc.numPages)
    .sort((a, b) => a.page - b.page || (a.half === b.half ? 0 : a.half === "left" ? -1 : 1))
    .map((s) => ({ spotlight: s, region: spotlightRegion(s, layout.leaves.some((l) => l.page === s.page && l.half)) })), [spotlightsSignature, doc.numPages, layout]);
  const [openSpotlight, setOpenSpotlight] = useState<number | null>(null);
  // A colour-and-motion background (an uploaded picture always takes precedence).
  const backdropScene = !viewer.backgroundKey && isBackgroundScene(viewer.backgroundPreset) ? viewer.backgroundPreset! : null;
  const jumpsSignature = JSON.stringify(editingExtras ? [] : jumps ?? []);
  const pageJumps = useMemo(() => readablePageJumps(JSON.parse(jumpsSignature), doc.numPages), [jumpsSignature, doc.numPages]);
  const stickersSignature = JSON.stringify(editingExtras ? [] : stickers ?? []);
  const pageStickers = useMemo(() => readablePageStickers(JSON.parse(stickersSignature), doc.numPages), [stickersSignature, doc.numPages]);
  const hotspotsSignature = JSON.stringify(editingExtras ? [] : hotspots ?? []);
  const pageHotspots = useMemo(() => readablePageHotspots(JSON.parse(hotspotsSignature), doc.numPages), [hotspotsSignature, doc.numPages]);
  const slideshowsSignature = JSON.stringify(editingExtras ? [] : slideshows ?? []);
  const pageSlideshows = useMemo(() => readablePageSlideshows(JSON.parse(slideshowsSignature), doc.numPages), [slideshowsSignature, doc.numPages]);
  const videoPlayer = useRef<PageVideoPlayer | null>(null);
  const [videoSound, setVideoSound] = useState<string | null>(null);
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
    const base = { ...lookFrom(viewer), ribbonGutter: ribbonGutterFor(viewer.ribbonPage, layout) };
    if (editingExtras) return {...base,studio:false};
    return previewLook && (previewable || offered.includes(previewLook)) ? { ...base, studio: previewLook === "studio" } : base;
  };
  const [settings, setSettings] = useState<Look>(lookFor);
  const latestSettings = useRef(settings);
  latestSettings.current = settings;
  // When the creator changes the settings in the editor, the book follows. A visitor's own
  // Simple/Studio choice is kept until then.
  useEffect(() => {
    setSettings(lookFor());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.bookStyle, viewer.pageStack, viewer.ribbon, viewer.ribbonColour, viewer.ribbonPage, layout, viewer.turnCurve, viewer.turnStyle, viewer.turnSpeed, viewer.look, viewer.finish, viewer.studioBrightness, viewer.studioTopLight, viewer.studioImperfections, viewer.studioLighting, viewer.simpleShadow, viewer.simpleShadowOpacity, viewer.simpleShading, viewer.tabStyle, viewer.studioLightingStrength, previewLook, editingExtras]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; dir: 1 | -1; from: number; progress: number; prepared: Promise<void>; moved: boolean;
    /** Last pointer position, and whether the scene shapes this turn from the pointer itself (a soft turn). */
    lastX: number; lastY: number; pointer: boolean } | null>(null);
  const [openNote, setOpenNote] = useState(false);
  const noteProgresses = useRef(new Map<string, number>());
  const canPan = zoom > 1 || openNote;
  const panning = useRef<{ id: number; x: number; y: number } | null>(null);
  // The 3D view: dragging the background around the book swings the camera over it, held to a dome above (see
  // orbit-view). Touching the pages, an arrow or a tab glides back to the normal straight-down view.
  const [view3d, setView3d] = useState(false);
  const orbitAt = useRef<Orbit>({ yaw: 0, pitch: 0 });
  const orbiting = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const orbitFrame = useRef(0);
  const glideOrbit = (to: Orbit, ms = 700) => {
    cancelAnimationFrame(orbitFrame.current);
    const from = orbitAt.current, start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - t, 3);
      orbitAt.current = scene.current?.orbit({ yaw: from.yaw + (to.yaw - from.yaw) * e, pitch: from.pitch + (to.pitch - from.pitch) * e }) ?? orbitAt.current;
      syncBounds();
      if (t < 1) orbitFrame.current = requestAnimationFrame(step);
    };
    orbitFrame.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(orbitFrame.current), []);
  const tilted = useRef(false);
  const previewAnnounced = useRef(false);
  useEffect(() => { previewAnnounced.current = false; }, [doc]);
  /** Back to the straight-down view (a no-op when already there). */
  const levelView = () => {
    if (!tilted.current) return;
    tilted.current = false;
    setView3d(false);
    glideOrbit({ yaw: 0, pitch: 0 });
  };
  // The homepage shows the 3D view off with a slow drift round the book until the reader takes over.
  useEffect(() => {
    if (!showcaseOrbit || !ready || !automaticMotion) return;
    let frame = 0, last = 0, announcing = false, cancelled = false;
    const started = showcaseOrbitStart ?? performance.now();
    const drift = (now: number) => {
      if (tilted.current) return;
      // The drift is slow, so 30 frames a second look the same and cost half: two whole books redraw for it.
      if (now - last < 33) { frame = requestAnimationFrame(drift); return; }
      last = now;
      // Timed from the page's clock, so the Simple and Studio copies side by side move as one. The overlays on the
      // pages wait meanwhile (as in any tilted view), so nothing needs measuring or re-rendering while it drifts.
      const s = now / 1000, ease = Math.min(1, (now - started) / 2500);
      orbitAt.current = scene.current?.orbit({ yaw: ease * 0.32 * Math.sin((s * 2 * Math.PI) / 16), pitch: ease * (0.24 + 0.1 * Math.sin((s * 2 * Math.PI) / 23)) }) ?? orbitAt.current;
      if (onPreviewReady && !previewAnnounced.current && !announcing && ease >= 1) {
        const renderer = scene.current;
        if (renderer) {
          announcing = true;
          void import("@/lib/portfolia/demo-readiness").then(({ prepareVisiblePreview }) => prepareVisiblePreview(
            () => renderer.shadersReady(),
            () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())),
          )).then(() => {
            if (!cancelled && scene.current === renderer) { previewAnnounced.current = true; onPreviewReady(); }
          }).catch(() => { announcing = false; });
        }
      }
      frame = requestAnimationFrame(drift);
    };
    setView3d(true);
    frame = requestAnimationFrame(drift);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (tilted.current) return;
      setView3d(false);
      glideOrbit({ yaw: 0, pitch: 0 }, 900);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcaseOrbit, showcaseOrbitStart, ready, automaticMotion, onPreviewReady]);
  const prefetchToken = useRef(0);
  const index = spreadIndex(layout.spreads, leaf);
  const spread = layout.spreads[index]!;
  // Page videos: one player per book. The scene asks which video belongs to each page picture and shows it inside
  // the paper; until a frame is ready (and where motion is off) the printed still shows.
  useEffect(() => {
    const s = scene.current;
    if (!s || !pageVideos.length) return;
    const player = createPageVideoPlayer({
      urlFor: async (key) => publicAssetUrl(key) ?? (await resolveAssetUrl({ id: key, blobKey: key })),
      onFrame: () => scene.current?.videoFrame(),
      onSound: setVideoSound,
    });
    videoPlayer.current = player;
    s.setVideoLookup((canvas) => {
      const at = layout.leaves[Number(canvas.dataset["seed"])];
      const v = at ? videosForLeaf(pageVideos, at)[0] : undefined;
      return v ? { video: player.element(v), rect: videoUvRect(v) } : null;
    });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => s.setVideoStill(motion.matches);
    still();
    motion.addEventListener("change", still);
    return () => {
      motion.removeEventListener("change", still);
      s.setVideoLookup(() => null);
      player.dispose();
      videoPlayer.current = null;
      setVideoSound(null);
    };
  }, [ready, pageVideos, layout]);
  // Only the videos on the pages in view play (at most two); the rest pause, and all pause in a hidden tab.
  const videosInView = useMemo(() => spread.filter((n): n is number => n !== null).flatMap((n) => videosForLeaf(pageVideos, layout.leaves[n]!).map((v) => v.id)), [spread, pageVideos, layout]);
  useEffect(() => {
    const apply = () => videoPlayer.current?.setInView(presentationActive ? videosInView : []);
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, [videosInView, ready, presentationActive]);
  const focus = bookFocus(spread, leaf, narrow);
  const atStart = narrow ? leaf === 0 : index === 0;
  const atEnd = narrow ? leaf === layout.leaves.length - 1 : index === layout.spreads.length - 1;
  const current = layout.leaves[leaf]!;
  const pages = spread.filter((n): n is number => n !== null).map((n) => layout.leaves[n]!.page);
  const onScrapbookPages = liveScrapbook?.onPages, shownLeaves = JSON.stringify(spread.filter((n): n is number => n !== null && (!narrow || n === leaf)).map((n) => ({ ...layout.leaves[n]!, ratio })));
  // The editor adds new notes, tabs and links to the pages in view.
  useEffect(() => { if (editingExtras) onScrapbookPages?.(JSON.parse(shownLeaves)); }, [editingExtras, onScrapbookPages, shownLeaves]);
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
    scene.current.setInset(captureQuality ? Math.max(0.35, getBookInset()) : getBookInset());
    const apply = (value: number) => { scene.current?.setInset(captureQuality ? Math.max(0.35, value) : value); syncBounds(); };
    return subscribeBookInset(apply);
  }, [ready, captureQuality]);
  useEffect(() => {
    if (!ready || fallback || !scene.current) return;
    const activeScene = scene.current;
    let cancelled = false;
    void loadNoteFonts(tabEntries).then(() => {
      if (cancelled || scene.current !== activeScene) return;
      activeScene.setTabs(tabEntries.map((t) => ({ id: t.id, text: t.label || String(t.page), colour: t.colour, position: t.position, scale:t.scale, font: t.font, fontSize: t.fontSize })), narrow);
      activeScene.setTabRest(Object.fromEntries(tabEntries.map((t) => [t.id, tabEdge(t.leaf, spread, narrow)])));
      syncBounds();
    });
    return () => { cancelled = true; };
  }, [ready, fallback, tabEntries, narrow]);
  useEffect(() => {
    if (!ready || fallback || busy || !scene.current || !tabEntries.length) return;
    scene.current.setTabRest(Object.fromEntries(tabEntries.map((t) => [t.id, tabEdge(t.leaf, spread, narrow)])));
    syncBounds();
  }, [leaf, busy]);
  /** Opening waits for the initial prepared batch and the current spread. */
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
    const source = pageLoader(doc, ratio, layout, density, () => scene.current?.maxTextureSize ?? 4096, lightweight, additions, pageLinks, previewTextureCap, pageVideos, pageHotspots);
    loader.current = source;
    // The newly built scene starts its actual selected lighting in parallel.
    let lightingPreparation: Promise<void> | undefined;
    setWarm(false);
    setWarmProgress({ done: 0, total: 0 });
    void source.preload((done, total) => {
      if (!cancelled) setWarmProgress({ done, total });
    }).then(async () => {
      // Simple can open independently; only an initial Studio appearance waits
      // for lighting, with a cap for slow downloads.
      try {
        if (latestSettings.current.studio) {
          // The active light is enough to reveal the page. Other demo lights and
          // the alternate appearance continue preparing independently.
          const preparation = lightweight
            ? scene.current?.prepare(false) ?? Promise.resolve()
            : lightingPreparation ?? Promise.resolve();
          await Promise.race([preparation, new Promise<void>((done) => setTimeout(done, 8000))]);
        }
      } catch {
        /* turning is allowed anyway */
      }
      // Shaders compile in parallel with the pages; the book appears once its first frame is really drawn.
      await scene.current?.shadersReady().catch(() => undefined);
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
        made = createBookScene(element, ratio, () => lost(made), () => restored(made), latestSettings.current, captureQuality);
        if (captureQuality) made.setInset(0.35);
      } catch (error) {
        console.error(`[flipbook] 3D could not start (try ${attempt + 1}):`, error);
        failed();
        return;
      }
      scene.current = made;
      const coverScene=made;
      void source.face(0).then(canvas=>{if(canvas&&!cancelled&&scene.current===coverScene)coverScene.setCoverColour(canvas);}).catch(()=>{});
      // The back board takes its own colour from the back cover, so its edges match that artwork.
      if(layout.leaves.length>2)void source.face(layout.leaves.length-1).then(canvas=>{if(canvas&&!cancelled&&scene.current===coverScene)coverScene.setCoverColour(canvas,"back");}).catch(()=>{});
      // A rebuilt view is prepared again (shaders, lighting) without holding anything up.
      lightingPreparation = made.prepare(offersBoth.current, demoLightingCycle).catch(() => undefined);
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
  }, [doc, ratio, layout, lightweight, previewTextureCap, captureQuality, fullSpread, additions, pageLinks, pageVideos, pageHotspots]);

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
  // A rebuilt scene keeps the 3D view's angle.
  useEffect(() => {
    if (scene.current && tilted.current) orbitAt.current = scene.current.orbit(orbitAt.current);
  }, [ready]);
  useEffect(() => {
    if (!busy && scene.current) {
      // A wheel gesture that has not reached the parent yet owns the zoom.
      scene.current.viewport(narrow, zoomFrame.current ? wheelZoom.current : zoom, focus);
      syncBounds();
    }
    if (!zoomFrame.current) wheelZoom.current = zoom;
  }, [narrow, zoom, focus, busy, ready, settings]);

  useEffect(() => {
    // A colour-and-motion scene is drawn behind the canvas, so the 3D backdrop stays clear.
    scene.current?.setBackdrop(backgroundUrl, viewer.backgroundFit, settings.studio && Boolean((viewer.backgroundLighting ?? true) || viewer.background3D), colour, Boolean(viewer.background3D), !backdropScene);
  }, [backgroundUrl, viewer.backgroundFit, viewer.backgroundLighting, viewer.background3D, settings.studio, ready, colour, backdropScene]);

  // On a touch screen: tap the left or right of the book to turn that way, and pinch to zoom the book itself
  // (not the whole web page). While two fingers are down nothing else (a pan, a swipe) happens.
  const minimumBookZoom = previewable ? .45 : homeScroll && !fullscreen ? 1 : additions.length ? .5 : 1;
  const pinching = useRef(false);
  const applyPinch = (asked: number, x: number, y: number) => {
    if (busy || wait || !scene.current) return;
    pinching.current = true;
    const next = Math.min(3, Math.max(minimumBookZoom, asked));
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
      if (releaseHomeScroll(homeScroll, Boolean(fullscreen), wheelZoom.current, event.deltaY) && !event.ctrlKey) return;
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const next = Math.min(3, Math.max(minimumBookZoom, wheelZoom.current * Math.exp(-dy * 0.0015)));
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
  }, [busy, wait, fallback, onZoomChange, homeScroll, fullscreen, minimumBookZoom]);

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
    // The next spread first (most likely), then the previous. Stay within the cache budget so speculative pages cannot evict the next turn.
    const targets = [index + 1, index - 1]
      .flatMap((i) => layout.spreads[i] ?? [])
      .filter((n): n is number => n !== null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let k = 0, geometryTarget = 0;
    const step = async () => {
      if (!alive.current || token !== prefetchToken.current) return;
      if (k >= targets.length) {
        if (geometryTarget >= 2 || narrow) return;
        const dir = (geometryTarget++ === 0 ? 1 : -1) as 1 | -1;
        const destination = layout.spreads[index + dir];
        if (destination) {
          try {
            const [from, to] = await Promise.all([faces(layout.spreads[index]!), faces(destination)]);
            if (alive.current && token === prefetchToken.current && !lock.current) scene.current?.prefetchTurn(from, to, dir);
          } catch { /* The actual turn reports any unavailable page. */ }
        }
        timer = setTimeout(() => void step(), 45);
        return;
      }
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
  }, [index, ready, warm, busy, loading, fallback, layout, narrow, faces, settings.turnCurve, settings.bookStyle]);

  /** Remembers a click that arrives mid-turn, so quick clicking moves quickly through the pages. */
  const queueStep = (direction: 1 | -1) => {
    if (jumping.current) return;
    queued.current = Math.max(-MAX_QUEUE, Math.min(MAX_QUEUE, queued.current + direction));
  };

  const move = useCallback(
    /** Turns one sheet in `direction`, or, given `toLeaf`, turns once straight to that leaf's spread (a jump). */
    async (direction: 1 | -1, chained = false, pace?: number, toLeaf?: number) => {
      if (wait || (jumping.current && !chained)) return;
      if (!chained) levelView();
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
      const jumpLeaf = toLeaf !== undefined && toLeaf >= 0 && toLeaf < layout.leaves.length ? toLeaf : null;
      const nextIndex = jumpLeaf !== null ? spreadIndex(layout.spreads, jumpLeaf) : narrow ? spreadIndex(layout.spreads, fromLeaf + direction) : fromIndex + direction;
      const nextSpread = layout.spreads[nextIndex]!;
      const nextLeaf = jumpLeaf !== null ? (narrow || nextSpread.includes(jumpLeaf) ? jumpLeaf : nextSpread.find((n) => n !== null)!) : narrow ? fromLeaf + direction : nextSpread.find((n) => n !== null)!;
      if (jumpLeaf !== null && (narrow ? jumpLeaf === fromLeaf : nextIndex === fromIndex)) return;
      const target = bookFocus(nextSpread, nextLeaf, narrow);
      lock.current = true;
      setBusy(true);
      setError(null);
      try {
        const [from, to] = await Promise.all([faces(fromSpread), faces(nextSpread)]);
        if (!alive.current) return;
        if (!fallback && scene.current) {
          await scene.current.prepareNotes(notesForSpread(fromSpread), notesForSpread(nextSpread));
          await scene.current.resetZoom();
          if (alive.current) onZoomChange(1);
          if (!alive.current) return;
          if (fromIndex === nextIndex) await scene.current.pan(target, quick ? 200 : 420);
          else await scene.current.turn(from, to, direction, target, (pace ?? (quick ? 0.5 : 1)) * demoTurnDurationScale, tabPlanFor(fromSpread, nextSpread, direction));
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
    [wait, narrow, layout, faces, fallback, onZoomChange, ready, goTo, closeNotes, tabPlanFor, demoTurnDurationScale],
  );

  /** Places the book at a page without animation (reduced motion, and the silent start of a long tab jump). */
  const place = useCallback(
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
          // A tab jump can skip several physical sheets. Place the destination
          // before its notes appear instead of flying them across skipped pages.
          scene.current.clearNotes();
          scene.current.show(to, false);
          scene.current.viewport(narrow, 1, target);
          onZoomChange(1);
          await scene.current.setNotes(notesForSpread(nextSpread));
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
    [wait, narrow, layout, faces, fallback, onZoomChange, ready, goTo, closeNotes, tabPlanFor, demoTurnDurationScale],
  );
  /**
   * A page tab (or a contents link) turns once, straight to its page: the pages in between go over together as
   * one sheet. Another destination chosen on the way gets one more turn when this one lands; arrows and clicks
   * wait until it arrives.
   */
  const jumpTo = useCallback(
    async (targetLeaf: number) => {
      if (wait || targetLeaf < 0 || targetLeaf >= layout.leaves.length) return;
      if (jumping.current) { jumping.current.target = targetLeaf; return; }
      if (lock.current) return;
      const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce || fallback || !scene.current) return place(targetLeaf);
      const run = { target: targetLeaf };
      jumping.current = run;
      queued.current = 0;
      const position = () => (narrow ? leafRef.current : spreadIndex(layout.spreads, leafRef.current));
      const goal = () => (narrow ? run.target : spreadIndex(layout.spreads, run.target));
      try {
        for (let guard = 0; alive.current && position() !== goal() && guard < 3; guard++) {
          const before = position(), distance = Math.abs(goal() - before);
          // A long jump turns a little quicker than a single page, never slower.
          await move(goal() > before ? 1 : -1, true, distance > 1 ? 0.8 : 1, run.target);
          if (position() === before) break;
        }
        if (alive.current && !narrow && layout.spreads[spreadIndex(layout.spreads, leafRef.current)]!.includes(run.target)) goTo(run.target);
      } finally {
        jumping.current = null;
        queued.current = 0;
      }
    },
    [wait, narrow, layout, fallback, place, move, goTo],
  );
  // The editor's scrapbook panel can ask for a page (an item listed from elsewhere in the book): turn straight there.
  const pageRequest = liveScrapbook?.pageRequest;
  useEffect(() => {
    if (!pageRequest || !bookReady) return;
    const found = layout.leaves.findIndex((l) => l.page === pageRequest.page);
    if (found >= 0) void jumpTo(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRequest?.t]);

  // When a turn ends, carry on with any clicks that arrived during it.
  useEffect(() => {
    if (busy || wait || queued.current === 0 || jumping.current) return;
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
  /**
   * A press on something on the page (a spotlight, link, contents link): let go straight away and it opens; move
   * first and the page takes over and turns, carried on by the viewport while the page's layer is hidden.
   */
  const handoff = useRef<{ id: number; x: number; y: number; dir: 1 | -1; started: boolean } | null>(null);
  const beginCornerDrag = (e: React.PointerEvent<HTMLElement>, direction: 1 | -1) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    // Touching the pages brings the view back square first (the turn follows from there).
    if (tilted.current) { levelView(); return; }
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
      lastX: e.clientX, lastY: e.clientY, pointer: false,
      prepared: Promise.resolve(),
    };
    drag.current = gesture;
    gesture.prepared = (async () => {
      const [from, to] = await Promise.all([faces(fromSpread), faces(nextSpread)]);
      if (!alive.current || !scene.current) return;
      await scene.current.resetZoom();
      if (!alive.current || !scene.current) return;
      onZoomChange(1);
      await scene.current.prepareNotes(notesForSpread(fromSpread), notesForSpread(nextSpread));
      await scene.current.prepareTurn(from, to, direction, target, 1, tabPlanFor(fromSpread, nextSpread, direction), true);
      // A soft turn follows the pointer from the exact point pressed; other turns follow how far it has moved.
      gesture.pointer = scene.current.beginPointerTurn(gesture.x, gesture.y);
      if (drag.current !== gesture) return;
      if (gesture.pointer) gesture.progress = scene.current.dragTurnPointer(gesture.lastX, gesture.lastY) ?? gesture.progress;
      else scene.current.dragTurn(gesture.progress);
    })();
  };

  /** Follows the pointer during a page drag (from the page edge, or handed over from an item on the page). */
  const moveCornerDrag = (e: React.PointerEvent<HTMLElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.id !== e.pointerId) return;
    if (Math.abs(e.clientX - gesture.x) > 4 || Math.abs(e.clientY - gesture.y) > 4) gesture.moved = true;
    gesture.lastX = e.clientX;
    gesture.lastY = e.clientY;
    const followed = gesture.pointer ? scene.current?.dragTurnPointer(e.clientX, e.clientY) : null;
    if (followed != null) { gesture.progress = followed; return; }
    // One page's width on screen, as the page-edge buttons measure it.
    const width = (((corners[1]?.x ?? 92) - (corners[0]?.x ?? 8)) / 2 / 100) * (viewportRef.current?.clientWidth ?? 800) || 1;
    gesture.progress = Math.min(1, Math.max(0, gesture.dir * (gesture.x - e.clientX) / width));
    scene.current?.dragTurn(gesture.progress);
  };
  const finishCornerDrag = async (e: React.PointerEvent<HTMLElement>, cancelled = false) => {
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
  const updateLook = (look: "clean" | "studio") => { setSettings((current) => ({ ...current, studio: look === "studio" })); onLookChange?.(look); };

  // Tell the viewer when the book is rendered and ready, so it can show nothing but a loader until then.
  useEffect(() => { if (error) { console.error("Book render error", error); onRenderError?.(error); } }, [error, onRenderError]);
  const bookReady = (ready > 0 || fallback) && warm && !loading && !error;
  // Stickers and slideshows move in a flat overlay over still pages. While that overlay is away (turning, tilted,
  // preparing) the pages carry still copies drawn on the paper, so they stay fixed to their page as it turns.
  useEffect(() => {
    const s = scene.current;
    if (!s || (!pageStickers.length && !pageSlideshows.length)) return;
    let live = true;
    const layers = new Map<number, HTMLCanvasElement | null>();
    pageLayers.current = [];
    void loadPageLayerPictures(pageStickers, pageSlideshows).then(() => {
      if (!live) return;
      s.setStickerLayerLookup((canvas) => {
        const n = Number(canvas.dataset["seed"]), at = layout.leaves[n];
        if (!at) return null;
        if (!layers.has(n)) {
          const stickers = stickersForLeaf(pageStickers, at), slides = slideshowsForLeaf(pageSlideshows, at);
          const layer = drawPageLayer(stickers, slides, ratio);
          layers.set(n, layer);
          if (layer && stickers.length) pageLayers.current.push({ canvas: layer, stickers, slides });
        }
        return layers.get(n) ?? null;
      });
    });
    return () => { live = false; pageLayers.current = []; s.setStickerLayerLookup(() => null); };
  }, [ready, pageStickers, pageSlideshows, layout, ratio]);
  const overlayShown = bookReady && !busy && !wait && !fallback && !view3d;
  useEffect(() => { scene.current?.setStickerLayerShown(!overlayShown); }, [overlayShown, ready]);
  // While the stickers ride on the turning (or tilted) paper, they keep moving: their layers are drawn again from
  // the page's clock about 30 times a second. Reduced motion keeps them still.
  useEffect(() => {
    if (overlayShown || !pageStickers.length || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0, last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < 33 || !pageLayers.current.length) return;
      last = now;
      for (const l of pageLayers.current) drawPageLayer(l.stickers, l.slides, ratio, l.canvas, now / 1000);
      scene.current?.stickerLayerFrame();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      // Back to the still pictures, ready for the next turn.
      for (const l of pageLayers.current) drawPageLayer(l.stickers, l.slides, ratio, l.canvas);
      scene.current?.stickerLayerFrame();
    };
  }, [overlayShown, pageStickers.length, ratio]);
  const [litNotesKey, setLitNotesKey] = useState("");
  const notesForSpread = (pages: Array<number | null>) => pages.flatMap((n, side) => n === null ? [] : foldoutsForLeaf(additions, layout.leaves[n]!).map(item => ({ item, side, seed: n + 1, exterior: n === 0 || n === layout.leaves.length - 1 })));
  useEffect(() => { noteProgresses.current.clear(); setOpenNote(false); }, [leaf, additions]);
  const currentNoteSpecs = spread.flatMap((n, side) => n === null || (narrow && n !== leaf) ? [] : foldoutsForLeaf(additions, layout.leaves[n]!).map(item => ({ item, side, seed: n + 1, exterior: n === 0 || n === layout.leaves.length - 1 })));
  const preparedNotesReady = !!scene.current?.notesReady(currentNoteSpecs);
  const notesKey = JSON.stringify([ready,spread,narrow,leaf,additions,bookReady,wait,fallback,busy]);
  useEffect(() => {
    const renderer = scene.current;
    if (!renderer || lock.current) return;
    let cancelled = false;
    if (!bookReady || wait || fallback) { setLitNotesKey(""); renderer.clearNotes(); return; }
    const visible = spread.flatMap((n,side) => n === null || (narrow && n !== leaf) ? [] : foldoutsForLeaf(additions,layout.leaves[n]!).map(item=>({item,side,seed: n + 1,exterior: n === 0 || n === layout.leaves.length - 1})));
    if (renderer.notesReady(visible)) { setLitNotesKey(notesKey); return; }
    setLitNotesKey("");
    void renderer.setNotes(visible).then(()=>{if(!cancelled)setLitNotesKey(notesKey);});
    return ()=>{cancelled=true;};
  }, [notesKey]);

  useEffect(() => {
    onReadyChange?.(bookReady);
  }, [bookReady, onReadyChange]);

  useEffect(() => {
    if (!onPreviewReady || !bookReady || previewAnnounced.current || (!fallback && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    let cancelled = false;
    void import("@/lib/portfolia/demo-readiness").then(({ prepareVisiblePreview }) => prepareVisiblePreview(
      () => scene.current?.shadersReady() ?? Promise.resolve(),
      () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())),
    )).then(() => { if (!cancelled) { previewAnnounced.current = true; onPreviewReady(); } });
    return () => { cancelled = true; };
  }, [onPreviewReady, bookReady, fallback, automaticMotion]);

  useEffect(() => {
    const renderer = scene.current;
    if (!onDemoReady || !bookReady || fallback || !renderer) return;
    let cancelled = false;
    void import("@/lib/portfolia/demo-readiness").then(({ prepareDemoPresentation }) => prepareDemoPresentation(
      () => renderer.demoReady(),
      () => renderer.shadersReady(),
      () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())),
    )).then(() => { if (!cancelled && scene.current === renderer) onDemoReady(); }).catch(() => {
      // Failed Studio preparation must not obstruct the independent Simple reader.
    });
    return () => { cancelled = true; };
  }, [bookReady, fallback, onDemoReady]);

  useEffect(() => {
    const renderer = scene.current;
    if (!onExporter || !bookReady || fallback || !renderer || !settings.studio) { onExporter?.(null); return; }
    const render = async (signature: string, save: (blob: Blob) => Promise<string>, progress: (value: string, fraction?: number) => void, signal: AbortSignal, video?: (blob: Blob) => void): Promise<import("@/lib/portfolia/rendered-studio").RenderedStudio> => {
      if (lock.current) throw new Error("The book is still moving. Please try again.");
      lock.current = true;
      const output = document.createElement("canvas"); output.width=Math.round(viewportRef.current!.clientWidth*2); output.height=Math.round(viewportRef.current!.clientHeight*2);
      const context = output.getContext("2d")!;
      let bytes = 0, completed = 0;
      const total = layout.spreads.length + layout.spreads.reduce((n, _, i) => n + notesForSpread(layout.spreads[i]!).filter(s=>s.item.style !== "sticky" || s.item.openable !== false).length * 3, 0) + Math.max(0, layout.spreads.length - 1) * 2;
      let status = "Preparing Studio…";
      const report = (value: string) => { status = value; progress(value, completed / total); };
      const write = async (blob: Blob) => { signal.throwIfAborted(); if(blob.size>50*1024*1024)throw new Error("A rendered clip exceeds the 50 MB file limit."); bytes += blob.size; if(bytes > 250*1024*1024) throw new Error("This render exceeds 250 MB. Use fewer pages or notes."); const key = await save(blob); completed++; progress(status, completed / total); return key; };
      const states: RenderedState[] = [];
      let stepFrame: (()=>Promise<void>) | undefined;
      const record = (action:()=>Promise<void>)=>recordStudioClip(output,action,signal,frame=>{stepFrame=frame;renderer.setCaptureClock(frame);});
      const draw = (canvas: HTMLCanvasElement) => { context.drawImage(canvas,0,0,output.width,output.height); };
      const specs = (index: number) => notesForSpread(layout.spreads[index]!);
      const show = async (index: number) => {
        signal.throwIfAborted(); if(scene.current!==renderer)throw new Error("The graphics renderer changed. Please try again."); const spread = layout.spreads[index]!;
        const images = await faces(spread);
        await renderer.setNotes(specs(index));
        renderer.show(images); renderer.viewport(false, 1, bookFocus(spread, spread.find(n=>n!==null)!, false));
        renderer.setTabRest(Object.fromEntries((tabPlanFor(spread, spread, 1) ?? []).map(t=>[t.id,t.to])));
        renderer.renderFrame(); return images;
      };
      const animateNote = async (id: string, opening: boolean) => {
        if(stepFrame) {
          await captureFrames(650,t=>{signal.throwIfAborted();const eased=t*t*(3-2*t);renderer.noteProgress(id,opening?eased:1-eased);renderer.renderFrame();},stepFrame);return;
        }
        const start = performance.now();
        await new Promise<void>((resolve,reject) => {
          const tick = () => { try { signal.throwIfAborted(); const t=Math.min(1,(performance.now()-start)/650); const eased=t*t*(3-2*t); renderer.noteProgress(id,opening?eased:1-eased); renderer.renderFrame(); if(t<1)requestAnimationFrame(tick);else resolve(); } catch(e){reject(e);} }; tick();
        });
      };
      try {
        await document.fonts.ready;
        const cover=await loader.current?.face(0);if(cover)renderer.setCoverColour(cover);
        // Captures show each page video's printed still, never whatever frame happened to be playing.
        renderer.setVideoStill(true);
        await renderer.captureReady();
        renderer.setFrameSink(draw);
        renderer.setInset(0);
        if (video) {
          // One continuous timeline: retain the cover and each spread long enough to read.
          const hold = async () => {
            if (stepFrame) await captureFrames(1600, () => { signal.throwIfAborted(); renderer.renderFrame(); }, stepFrame);
            else {
              const start = performance.now();
              while (performance.now() - start < 1600) {
                signal.throwIfAborted(); renderer.renderFrame();
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
              }
            }
          };
          let from = await show(0);
          const blob = await record(async () => {
            await hold();
            for (let i = 1; i < layout.spreads.length; i++) {
              signal.throwIfAborted();
              progress(`Exporting spread ${i + 1} of ${layout.spreads.length}`, i / layout.spreads.length);
              const next = layout.spreads[i]!, to = await faces(next);
              await renderer.prepareNotes(specs(i - 1), specs(i));
              await renderer.turn(from, to, 1, bookFocus(next, next.find(n => n !== null)!, false), 1, tabPlanFor(layout.spreads[i - 1]!, next, 1));
              from = await show(i);
              await hold();
            }
          });
          signal.throwIfAborted(); video(blob); progress("Video ready to download.", 1);
          return { version: 1, signature, createdAt: Date.now(), width: output.width, height: output.height, states: [], bytes: blob.size };
        }
        for(let i=0;i<layout.spreads.length;i++) {
          report(`Rendering page ${i+1} of ${layout.spreads.length}`);
          await show(i);
          const bounds=renderer.pageBounds();
          const hotspot = (item: {id:string;title?:string;label?:string;x:number;y:number;width?:number;height?:number;size?:number},side:number):RenderHotspot => {
            const b=bounds[side]!; return {id:item.id,label:item.title||item.label||"Open note",x:b.x+item.x*b.width,y:b.y+item.y*b.height,width:(item.width??item.size??.1)*b.width,height:(item.height??item.size??.1)*b.height};
          };
          const spread=layout.spreads[i]!;
          const state:RenderedState={pages:spread.filter((n):n is number=>n!==null).map(n=>layout.leaves[n]!.page),still:await write(await canvasStill(output)),pageBounds:bounds.filter((_, side)=>spread[side]!==null),notes:[],links:[]};
          for(const spec of specs(i).filter(s=>s.item.style !== "sticky" || s.item.openable !== false)) {
            const open=await write(await record(()=>animateNote(spec.item.id,true)));
            const openStill=await write(await canvasStill(output));
            const close=await write(await record(()=>animateNote(spec.item.id,false)));
            state.notes.push({...hotspot(spec.item,spec.side),open,close,openStill});
          }
          spread.forEach((n,side)=>{if(n===null)return; const leaf=layout.leaves[n]!; pageLinks.filter(l=>l.page===leaf.page&&(!leaf.half||l.half===leaf.half)).forEach(l=>state.links.push({...hotspot(l,side),url:l.url}));});
          renderer.tabRects().forEach(rect=>{const tag=pageTags.find(t=>t.id===rect.id);if(tag)state.links.push({...rect,label:tag.label||String(tag.page),page:tag.page});});
          states.push(state);
        }
        for(let i=0;i<states.length;i++) for(const dir of [1,-1] as const) {
          const next=i+dir; if(next<0||next>=states.length)continue;
          report(`Rendering ${dir===1?"forward":"backward"} turn ${i+1}`);
          const from=await show(i),to=await faces(layout.spreads[next]!);
          await renderer.prepareNotes(specs(i),specs(next));
          const spread=layout.spreads[next]!;
          const clip=await write(await record(()=>renderer.turn(from,to,dir,bookFocus(spread,spread.find(n=>n!==null)!,false),1,tabPlanFor(layout.spreads[i]!,spread,dir))));
          if(dir===1)states[i]!.forward=clip;else states[i]!.backward=clip;
        }
        signal.throwIfAborted();if(scene.current!==renderer)throw new Error("The graphics renderer changed. Please try again.");
        return {version:1,signature,createdAt:Date.now(),width:output.width,height:output.height,states,bytes};
      } finally { renderer.setCaptureClock(); renderer.setFrameSink(); renderer.setVideoStill(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches); lock.current=false; if(alive.current) { await renderer.setNotes(currentNoteSpecs); renderer.show(await faces(spread)); renderer.viewport(narrow,zoom,bookFocus(spread,leafRef.current,narrow)); } }
    };
    onExporter({ render, video: async (progress, signal) => {
      let result: Blob | undefined;
      await render("", async () => "", progress, signal, blob => { result = blob; });
      if (!result) throw new Error("The video could not be created.");
      return result;
    }});
    return () => onExporter(null);
  }, [onExporter, bookReady, fallback, ready, settings.studio, layout, faces, additions, pageLinks, pageTags]);

  const [testTurn, setTestTurn] = useState(0);
  useEffect(() => {
    if (!previewable) return;
    return subscribePreviewTurn(() => setTestTurn(value => value + 1));
  }, [previewable]);
  useEffect(() => {
    if (!previewable || !bookReady || busy || wait || error || (atStart && atEnd)) return;
    if (takePreviewTurn()) void move(atEnd ? -1 : 1);
  }, [previewable, testTurn, bookReady, busy, wait, error, atStart, atEnd, move]);

  const autoDirection = useRef<1 | -1>(1);
  useEffect(() => {
    if (!autoTurn || !automaticMotion || !bookReady || busy || wait || error || (atStart && atEnd)) return;
    if (atEnd) autoDirection.current = -1;
    else if (atStart) autoDirection.current = 1;
    const timer = setTimeout(() => { void move(autoDirection.current); }, Math.max(800, autoTurnDelay));
    return () => clearTimeout(timer);
  }, [autoTurn, automaticMotion, autoTurnDelay, bookReady, busy, wait, error, atStart, atEnd, move]);

  // Recordings, the live scrapbook editor and the flat fallback keep the straight-down view.
  const allow3d = !frameAspect && !editingExtras && !fallback;
  return (
    <section aria-label="Interactive PDF book" data-look={settings.studio ? "studio" : "simple"}>
      <div
        ref={viewportRef}
        className="pf-book-viewport"
        style={{ ...(frameAspect ? { height: "auto", aspectRatio: String(frameAspect) } : fullscreen ? { height: FULL_HEIGHT } : immersive ? { height: "max(420px, 100svh)" } : {}), touchAction: canPan ? "none" : "pan-y" }}
        data-busy={busy || wait}
        data-narrow={narrow}
        data-panning={panning.current !== null}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && e.target !== host.current && e.target !== host.current?.firstChild) return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (!e.isPrimary || pinching.current) return;
          // Dragging the background (not the pages) looks round the book in 3D. Touch keeps its swipe to turn.
          if (allow3d && !canPan && e.pointerType !== "touch" && !busy && scene.current) {
            orbiting.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (!canPan || busy || wait || !scene.current) return;
          panning.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (handoff.current?.started && drag.current?.id === e.pointerId) { moveCornerDrag(e); return; }
          const spin = orbiting.current;
          if (spin && spin.id === e.pointerId && scene.current) {
            if (!spin.moved) {
              if (Math.hypot(e.clientX - spin.x, e.clientY - spin.y) < 4) return;
              spin.moved = true;
              cancelAnimationFrame(orbitFrame.current);
              tilted.current = true;
              setView3d(true);
            }
            orbitAt.current = scene.current.orbit(orbitDrag(orbitAt.current, e.clientX - spin.x, e.clientY - spin.y, e.currentTarget.clientHeight));
            spin.x = e.clientX;
            spin.y = e.clientY;
            syncBounds();
            return;
          }
          const pan = panning.current;
          if (!pan || pan.id !== e.pointerId || pinching.current) return;
          // The scene keeps the view inside the initial framing.
          scene.current?.dragPan(e.clientX - pan.x, e.clientY - pan.y);
          pan.x = e.clientX;
          pan.y = e.clientY;
          if (scene.current) syncBounds();
        }}
        onPointerUp={(e) => {
          if (handoff.current?.started && drag.current?.id === e.pointerId) { handoff.current = null; void finishCornerDrag(e); return; }
          if (panning.current?.id === e.pointerId) panning.current = null;
          if (orbiting.current?.id === e.pointerId) orbiting.current = null;
        }}
        onPointerCancel={(e) => {
          if (handoff.current?.started && drag.current?.id === e.pointerId) { handoff.current = null; void finishCornerDrag(e, true); return; }
          if (panning.current?.id === e.pointerId) panning.current = null;
          if (orbiting.current?.id === e.pointerId) orbiting.current = null;
        }}
        onTouchStart={(e) => {
          touch.current =
            e.touches.length === 1 && !canPan && !view3d && !(e.target as Element).closest("button, a, input, select, textarea, [data-foldout], [role=dialog], [role=toolbar]")
              ? { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }
              : null;
        }}
        onTouchMove={(e) => {
          if (e.touches.length !== 1) touch.current = null;
        }}
        onTouchCancel={() => { touch.current = null; }}
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
        <BackdropLayer animate={presentationActive} colour={colour} imageUrl={backgroundUrl} fit={viewer.backgroundFit as Partial<BackgroundFit> | undefined} scene={backdropScene ?? undefined} />
        <div ref={host} className={cn("pf-book-canvas", (fallback || !bookReady) && "invisible")} />
        {fallback && (
          <div className={cn("pf-book-fallback", !bookReady && "invisible")}>
            <canvas ref={fallbackCanvas} />
            <p>3D is unavailable on this device. You can still read every page.</p>
          </div>
        )}
        {/* Links, videos and notes sit flat over the page, so they wait while the 3D view is tilted. */}
        {bookReady && !busy && !wait && !fallback && !view3d && spread.map((n, side) => {
          const bounds = pageBounds[side];
          if (n === null || !bounds || (narrow && n !== leaf)) return null;
          const visible = foldoutsForLeaf(additions, layout.leaves[n]!);
          const onLeaf = linksForLeaf(pageLinks, layout.leaves[n]!);
          return <div key={`${n}:${settings.studio}`} className="pointer-events-none absolute z-30" style={{ left: `${bounds.x}%`, top: `${bounds.y}%`, width: `${bounds.width}%`, height: `${bounds.height}%` }}
            onPointerDownCapture={(e) => {
              handoff.current = null;
              const target = e.target as Element;
              if (editingExtras || !e.isPrimary || !target.closest("a, button, [role=button]") || target.closest("[data-foldout]")) return;
              const h = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: (side === 0 ? -1 : 1) as 1 | -1, started: false };
              handoff.current = h;
              // Watched on the window, so even a quick flick that leaves the item at once is seen. Once it has moved,
              // the viewport takes the pointer and turns the page from there.
              const stop = () => { window.removeEventListener("pointermove", watch); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
              const watch = (ev: PointerEvent) => {
                if (ev.pointerId !== h.id || handoff.current !== h) return stop();
                if (Math.hypot(ev.clientX - h.x, ev.clientY - h.y) < 8) return;
                stop();
                h.started = true;
                const viewport = viewportRef.current;
                if (!viewport) return;
                beginCornerDrag({ isPrimary: ev.isPrimary, pointerType: ev.pointerType, button: 0, clientX: ev.clientX, clientY: ev.clientY, pointerId: ev.pointerId,
                  preventDefault: () => ev.preventDefault(), currentTarget: viewport } as unknown as React.PointerEvent<HTMLElement>, h.dir);
                if (drag.current?.id !== h.id) handoff.current = null;
              };
              window.addEventListener("pointermove", watch);
              window.addEventListener("pointerup", stop);
              window.addEventListener("pointercancel", stop);
            }}
            onClickCapture={(e) => { if (handoff.current?.started) { e.preventDefault(); e.stopPropagation(); } }}>
            {editingExtras && <LiveScrapbookPage leaf={layout.leaves[n]!} side={side===0?'left':'right'} ratio={ratio} neighbour={spread[1-side] != null ? layout.leaves[spread[1-side]!] : undefined}/>}
            {onLeaf.map(link => <PageLinkAnchor key={link.id} link={link} visible painted />)}
            {videosForLeaf(pageVideos, layout.leaves[n]!).filter(v => !v.silent).map(v => <PageVideoSound key={v.id} video={v} on={videoSound === v.id} onToggle={() => videoPlayer.current?.toggleSound(v.id)} />)}
            {slideshowsForLeaf(pageSlideshows, layout.leaves[n]!).map(s => <PageSlideshowMark key={s.id} slideshow={s} />)}
            {stickersForLeaf(pageStickers, layout.leaves[n]!).map(s => <PageStickerMark key={s.id} sticker={s} />)}
            {hotspotsForLeaf(pageHotspots, layout.leaves[n]!).map(h => <PageHotspotMark key={h.id} hotspot={h} />)}
            {jumpsForLeaf(pageJumps, layout.leaves[n]!).map(j => <PageJumpLink key={j.id} jump={j} onGo={(page) => void jumpTo(layout.leaves.findIndex((l) => l.page === page))} />)}
            {spotlightsForLeaf(spotlightViews.map(v => v.spotlight), layout.leaves[n]!).map(s => <SpotlightTarget key={s.id} spotlight={s} onOpen={() => setOpenSpotlight(spotlightViews.findIndex(v => v.spotlight.id === s.id))} />)}
            {visible.map(item => <StoredFoldout key={`${item.id}:${(preparedNotesReady || litNotesKey === notesKey)}:${JSON.stringify(item)}`} item={item} demoAnimate={demoNotes} baked={item.style !== "sticky"} sceneRendered={(preparedNotesReady || litNotesKey === notesKey)} onProgress={p => {
              noteProgresses.current.set(item.id, p);
              setOpenNote([...noteProgresses.current.values()].some(value => value > .001));
              scene.current?.noteProgress(item.id, p);
              syncBounds();
            }} closers={noteClosers} />)}
          </div>;
        })}
        {openSpotlight !== null && spotlightViews[openSpotlight] && (
          <SpotlightLightbox doc={doc} views={spotlightViews} index={openSpotlight} onIndex={setOpenSpotlight} onClose={() => setOpenSpotlight(null)} />
        )}
        {bookReady && !fallback && !view3d && tabRects.length > 0 && (
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
          !canPan &&
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
              onPointerDown={(e) => { setPeek(null); beginCornerDrag(e, d); }}
              onPointerLeave={() => setPeek(null)}
              onPointerMove={(e) => {
                const gesture = drag.current;
                // A mouse resting near a page's outer corner lifts it a little, a hint that pressing turns the page.
                if (!gesture && e.pointerType === "mouse") {
                  const r = e.currentTarget.getBoundingClientRect(), rx = (e.clientX - r.left) / r.width, ry = (e.clientY - r.top) / r.height;
                  const outer = side === "right" ? rx > 0.8 : rx < 0.2;
                  const corner = !outer ? null : ry > 0.82 ? "bottom" : ry < 0.18 ? "top" : null;
                  setPeek((was) => (corner ? (was?.side === d && was.corner === corner ? was : { side: d, corner }) : null));
                }
                if (!gesture || gesture.id !== e.pointerId) return;
                if (Math.abs(e.clientX - gesture.x) > 4 || Math.abs(e.clientY - gesture.y) > 4) gesture.moved = true;
                gesture.lastX = e.clientX;
                gesture.lastY = e.clientY;
                const followed = gesture.pointer ? scene.current?.dragTurnPointer(e.clientX, e.clientY) : null;
                if (followed != null) { gesture.progress = followed; return; }
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
        {peek && !busy && !wait && bookReady && !view3d && !fallback && !narrow && (() => {
          const bounds = pageBounds[peek.side === 1 ? 1 : 0];
          if (!bounds) return null;
          const right = peek.side === 1, bottom = peek.corner === "bottom";
          // A small, page-toned lift, about a twentieth of the page width.
          const size = Math.round(Math.max(8, Math.min(24, (bounds.width / 100) * (viewportRef.current?.clientWidth ?? 800) * 0.05)));
          return (
            <span aria-hidden className={cn("pf-corner-fold", right ? "pf-fold-right" : "pf-fold-left", bottom ? "pf-fold-bottom" : "pf-fold-top")}
              style={{
                left: right ? undefined : `${bounds.x}%`, right: right ? `${100 - bounds.x - bounds.width}%` : undefined,
                top: bottom ? undefined : `${bounds.y}%`, bottom: bottom ? `${100 - bounds.y - bounds.height}%` : undefined,
                width: size, height: size,
              }} />
          );
        })()}
        {loadingIndicator && wait && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <BookLoader tone={tone} label="" />
          </div>
        )}
        {error && (
          <p className="pf-book-status" role="alert">
            {error}
          </p>
        )}
        {showNavigation && <>
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
        </>}
        {showPageNumber && <p aria-live="polite" className={cn("pf-book-page-number pointer-events-none absolute inset-x-0 top-3 z-10 text-center text-[11px] tabular-nums transition-opacity duration-300", awake ? "opacity-100" : "opacity-0", tone === "dark" ? "text-white/45" : "text-black/40")}>
          <span className={cn("inline-flex rounded-full px-3 py-2 ring-1 backdrop-blur-sm", tone === "dark" ? "bg-slate-950/75 text-white ring-white/20" : "bg-white/90 text-slate-700 ring-black/15")}>{label}</span>
        </p>}
        {/* Simple / Studio: only offered when the creator has enabled both. Everything else is set in the editor. */}
        {enabledLooks.length > 1 && !frameAspect && showAppearance && (
          <div className={cn("absolute bottom-1.5 left-1.5 z-20 flex w-fit transition-opacity duration-300", awake ? "opacity-100" : "pointer-events-none opacity-0")}>
            <Segmented className="bg-white text-black [&_[role=radio]]:text-black [&_[role=radio][aria-checked=true]]:bg-slate-900 [&_[role=radio][aria-checked=true]]:text-white" label="Book appearance" value={settings.studio ? "studio" : "clean"} options={[["clean", "Simple"], ["studio", "Studio"]] as const} onChange={updateLook} />
          </div>
        )}
        {/* Touch screens: hold this and drag to look round the book in 3D (on a phone the background is too small to
            drag, and a drag on the pages turns them). A tap brings the view back square. */}
        {allow3d && bookReady && (
          <button
            type="button"
            aria-label="Hold and drag to look round the book in 3D. Tap to straighten."
            className={cn("absolute bottom-1.5 right-1.5 z-20 hidden size-11 touch-none select-none items-center justify-center rounded-full shadow-sm ring-1 backdrop-blur-md transition-transform duration-200 active:scale-95 [@media(pointer:coarse)]:flex",
              tone === "dark" ? "bg-slate-950/70 text-white ring-white/15" : "bg-white/85 text-slate-700 ring-black/10", view3d && "ring-2 ring-current")}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (!e.isPrimary || busy || !scene.current) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              orbiting.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
            }}
            onPointerMove={(e) => {
              const spin = orbiting.current;
              if (!spin || spin.id !== e.pointerId || !scene.current) return;
              if (!spin.moved) {
                if (Math.hypot(e.clientX - spin.x, e.clientY - spin.y) < 4) return;
                spin.moved = true;
                cancelAnimationFrame(orbitFrame.current);
                tilted.current = true;
                setView3d(true);
              }
              // A thumb's travel is short, so the button turns the view a little more per pixel than the background.
              orbitAt.current = scene.current.orbit(orbitDrag(orbitAt.current, (e.clientX - spin.x) * 1.6, (e.clientY - spin.y) * 1.6, viewportRef.current?.clientHeight ?? 600));
              spin.x = e.clientX;
              spin.y = e.clientY;
            }}
            onPointerUp={(e) => {
              const spin = orbiting.current;
              if (spin?.id !== e.pointerId) return;
              orbiting.current = null;
              if (!spin.moved) levelView();
            }}
            onPointerCancel={() => { orbiting.current = null; }}
          >
            <Rotate3d className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
