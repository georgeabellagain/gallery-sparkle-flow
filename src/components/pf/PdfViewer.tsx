import { READER_SLIDE_MS, READER_SLIDE_DISTANCE } from "@/lib/portfolia/reader-slide";
import type { Foldout } from "@/lib/portfolia/foldouts";
import type { PageLink, PageTag } from "@/lib/portfolia/page-extras";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { List, Copy } from "lucide-react";
import { projectFromHash, projectPath, readableProjects, type PortfolioProject } from "@/lib/portfolia/projects";
import { BookOpen, ChevronLeft, ChevronRight, Download, FileText, LayoutGrid, Maximize2, Minimize2, ScrollText, User, ZoomIn, ZoomOut } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { describePdfError, loadPdfjs } from "@/lib/portfolia/pdf";
import { cn } from "@/lib/utils";
import { BookView } from "@/components/pf/BookView";
import { Progress } from "@/components/ui/progress";
import { getPreviewLook, pinPreviewLook, subscribePreviewLook } from "@/lib/portfolia/preview-look";
import { isTouchDevice } from "@/lib/portfolia/scan";
import { useTouchGestures } from "@/components/pf/touch-gestures";
import { BookLoader } from "@/components/pf/book-loader";
import { DEFAULT_VIEWER, type ViewerSettings } from "@/lib/portfolia/store";
import { backgroundColour, fitTransform } from "@/lib/portfolia/background";
import { IconButton, LogoMark, Panel, Segmented, iconClass, useDismiss, useTone } from "@/components/pf/viewer-ui";

import type { PageStudioRenderer, PageStudioSettings } from "@/lib/portfolia/page-studio";

type Source = { blob: Blob } | { url: string };

const noop = () => {};

/**
 * The page-turning loading icon, and holding the portfolio back until it has rendered. Switched off for now:
 * the viewer shows its pages as they are ready, with a simple "Loading" note. Switch this on to bring it back.
 */
const SHOW_LOADER = true;

const MODES = [
  ["scroll", "Scroll", ScrollText],
  ["paged", "Page by page", FileText],
  ["book", "Flipbook", BookOpen],
] as const;

/**
 * Integrated PDF viewer. The page itself is all that fills the screen; everything
 * else is a quiet icon that brightens when pointed at. Pages render only as they
 * approach the viewport; text stays selectable and web links in the PDF stay clickable.
 */
export function PdfViewer({
  source,
  fileName,
  allowDownload,
  onDownload,
  compact,
  immersive,
  credit,
  startFullscreen,
  backdrop,
  viewer,
  startPage = 1,
  projects,
  foldouts,
  tags,
  links,
  projectCode,
  profile,
  profileImageUrl,
  home,
  backgroundUrl,
  controls,
  autoTurn = false,
  demoNotes = false,
  onContentReadyChange,
  autoTurnDelay,
  fullSpread = false,
  onBookReadyChange,
  onLoadError,
  lightweight = false,
}: {
  source: Source | null;
  fileName: string;
  allowDownload?: boolean;
  onDownload?: () => void;
  compact?: boolean;
  immersive?: boolean;
  /** Show the small "Hosted on Portfolia" text at the bottom of the viewer (the free plan). */
  credit?: boolean;
  /** Open full screen on a phone or tablet once the portfolio has loaded (a portfolio opened from its QR code). */
  startFullscreen?: boolean;
  /** The older "behind the PDF" colour some Personal portfolios have. */
  backdrop?: string;
  viewer?: ViewerSettings;
  startPage?: number;
  projects?: PortfolioProject[];
  foldouts?: Foldout[];
  tags?: PageTag[];
  links?: PageLink[];
  /** Enables hash links on public readers. Editor previews never read the URL hash. */
  projectCode?: string;
  /** The person's details, shown from a small profile icon. */
  profile?: ReactNode;
  profileImageUrl?: string;
  /** Shows the small logo that links to the home page. */
  home?: boolean;
  /** An uploaded picture to show behind the PDF instead of the colour. */
  backgroundUrl?: string;
  /** Whether to show the icons. Defaults to on, except for small thumbnails. */
  controls?: boolean;
  autoTurn?: boolean;
  /** Only enabled by the homepage showcase; uses the actual flap animation. */
  demoNotes?: boolean;
  onContentReadyChange?: (ready: boolean) => void;
  autoTurnDelay?: number;
  fullSpread?: boolean;
  /** A lighter homepage demonstration; full visitor readers keep their resolution. */
  lightweight?: boolean;
  onBookReadyChange?: (ready: boolean) => void;
  onLoadError?: (message: string) => void;
}) {
  const view = { ...DEFAULT_VIEWER, ...viewer };
  // The creator chooses which reading modes visitors get, and which one opens first.
  const availableModes = view.modes?.length ? view.modes : MODES.map(([m]) => m);
  const startMode = availableModes.includes(view.mode) ? view.mode : availableModes[0] ?? "scroll";
  const colour = backgroundColour(view, backdrop);
  const tone = useTone(colour, backgroundUrl);
  const showControls = controls ?? !compact;
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(startMode === "scroll" ? 1.3 : 1);
  const [current, setCurrent] = useState(1);
  const [nativeFull, setNativeFull] = useState(false);
  // Where the browser cannot take a page full screen (iPhone Safari cannot), the viewer fills the window itself.
  const [pseudoFull, setPseudoFull] = useState(false);
  const full = nativeFull || pseudoFull;
  const [panel, setPanel] = useState<"profile" | "pages" | "projects" | null>(null);
  const [projectMessage, setProjectMessage] = useState("");
  const [manualProjectLink, setManualProjectLink] = useState("");
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => { onContentReadyChange?.(contentReady); }, [contentReady, onContentReadyChange]);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const shownReady = !SHOW_LOADER || contentReady;
  const bookReadyChanged = useCallback((ready: boolean) => {
    setContentReady(ready);
    onBookReadyChange?.(ready);
  }, [onBookReadyChange]);
  const bookRenderError = useCallback((message: string) => setError(message), []);
  useEffect(() => { if (error) onLoadError?.(error); }, [error, onLoadError]);
  const rootRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  useEffect(() => setProfileImageFailed(false), [profileImageUrl]);
  useDismiss(profileRef, panel === "profile", () => setPanel(null));
  const [downloadUrl, setDownloadUrl] = useState<string>();
  useDismiss(clusterRef, panel !== null && panel !== "profile", () => setPanel(null));

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
        const document = loaded;
        const dimensions = async (i: number) => {
          const vp = (await document.getPage(i)).getViewport({ scale: 1 });
          return { w: vp.width, h: vp.height };
        };
        const s: { w: number; h: number }[] = lightweight
          ? await Promise.all(Array.from({ length: document.numPages }, (_, i) => dimensions(i + 1)))
          : [];
        if (!lightweight) for (let i = 1; i <= document.numPages; i++) s.push(await dimensions(i));
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
  }, [source, lightweight]);

  type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
  type FullscreenEl = HTMLDivElement & { webkitRequestFullscreen?: () => void };
  useEffect(() => {
    const on = () => {
      const d = document as FullscreenDoc;
      setNativeFull((d.fullscreenElement ?? d.webkitFullscreenElement) === rootRef.current);
    };
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);
  useEffect(() => {
    if (!pseudoFull) return;
    // Held in place: the page behind does not scroll, and Escape leaves, as in real full screen.
    const html = document.documentElement;
    const before = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPseudoFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = before[0] ?? "";
      document.body.style.overflow = before[1] ?? "";
      window.removeEventListener("keydown", onKey);
    };
  }, [pseudoFull]);

  const toggleFull = async () => {
    const d = document as FullscreenDoc;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      try {
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      } catch {
        /* already out */
      }
      return;
    }
    if (pseudoFull) {
      setPseudoFull(false);
      return;
    }
    const el = rootRef.current as FullscreenEl | null;
    const request: ((this: HTMLElement) => Promise<void> | void) | undefined = el?.requestFullscreen ?? el?.webkitRequestFullscreen;
    if (el && request && (d.fullscreenEnabled ?? d.webkitFullscreenEnabled ?? true)) {
      try {
        await request.call(el);
        return;
      } catch {
        /* refused: use the in-page full screen instead */
      }
    }
    setPseudoFull(true);
  };

  const [mode, setMode] = useState<"scroll" | "paged" | "book">(startMode);
  const modeLive = useRef(mode);
  modeLive.current = mode;
  const [jump, setJump] = useState<{ page: number; t: number } | null>(null);
  const z = (d: number) => setZoom((v) => Math.min(3, Math.max(1, Math.round((v + d) * 100) / 100)));
  const zoomStep = mode === "scroll" ? 0.05 : 0.25;
  const total = doc?.numPages ?? 0;
  const sections = useMemo(() => readableProjects(projects, total), [projects, total]);
  const go = (d: number) => setCurrent((c) => Math.min(total, Math.max(1, c + d)));
  // A portfolio opened from its QR code fills the screen on a phone. (A browser only allows real full screen after
  // a tap, so this is the in-page full screen: it hides the rest of the site and keeps the exit icon.)
  const startedFull = useRef(false);
  useEffect(() => {
    if (!startFullscreen || startedFull.current || !doc) return;
    startedFull.current = true;
    if (isTouchDevice()) setPseudoFull(true);
  }, [startFullscreen, doc]);
  // Page by page on a touch screen: tap the left or right to turn that way, and pinch to zoom the page.
  // (The page scrolls up and down only at normal size, so a pinch is never mistaken for a sideways scroll; once zoomed in it moves every way.)
  const pagedRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<HTMLDivElement>(null);
  const zoomLive = useRef(zoom);
  zoomLive.current = zoom;
  useEffect(() => {
    const el = panRef.current;
    if (!el || !doc || mode === "book" || zoom <= 1) return;
    let drag: { id: number; x: number; y: number; left: number; top: number } | null = null;
    let moved = false;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      moved = false;
      if ((event.target as Element).closest("a,button,input,select,textarea")) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
      el.setPointerCapture(event.pointerId);
      el.style.cursor = "grabbing";
      event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) moved = true;
      if (!moved) return;
      event.preventDefault();
      el.scrollLeft = drag.left - dx;
      el.scrollTop = drag.top - dy;
    };
    const end = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (el.hasPointerCapture(drag.id)) el.releasePointerCapture(drag.id);
      drag = null;
      el.style.cursor = "grab";
    };
    const click = (event: MouseEvent) => {
      if (!moved) return;
      moved = false;
      event.preventDefault(); event.stopPropagation();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("lostpointercapture", end);
    el.addEventListener("click", click, true);
    return () => {
      if (drag && el.hasPointerCapture(drag.id)) el.releasePointerCapture(drag.id);
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end); el.removeEventListener("pointercancel", end);
      el.removeEventListener("lostpointercapture", end); el.removeEventListener("click", click, true);
      el.style.cursor = "";
    };
  }, [mode, doc, zoom > 1]);
  useEffect(() => {
    const el = pagedRef.current;
    if (mode !== "paged" || !doc || !el) return;
    let frame = 0;
    let delta = 0;
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1);
      delta += Math.max(-120, Math.min(120, pixels));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const factor = Math.exp(-Math.max(-240, Math.min(240, delta)) * 0.001);
        delta = 0;
        setZoom(value => Math.min(3, Math.max(1, value * factor)));
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { el.removeEventListener("wheel", wheel); cancelAnimationFrame(frame); };
  }, [mode, doc]);
  useTouchGestures(pagedRef, {
    enabled: mode === "paged" && !!doc,
    zoom: () => zoomLive.current,
    onTap: (side) => {
      if (side === "left") go(-1);
      else if (side === "right") go(1);
    },
    onPinch: (asked) => setZoom(Math.min(3, Math.max(1, Math.round(asked * 20) / 20))),
  });

  const jumpTo = (n: number) => {
    setCurrent(n);
    setJump({ page: n, t: Date.now() });
    if (mode === "scroll") rootRef.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => setMode(startMode), [startMode]);
  const enabledLooks = view.looks?.length ? view.looks : [view.look];
  const [selectedLook, setSelectedLook] = useState(view.look);
  const [previewLook, setPreviewLook] = useState(() => compact ? getPreviewLook() : null);
  useEffect(() => { setSelectedLook(view.look); }, [view.look]);
  useEffect(() => {
    if (!compact) return;
    setPreviewLook(getPreviewLook());
    return subscribePreviewLook(setPreviewLook);
  }, [compact]);
  const requestedLook = previewLook ?? selectedLook;
  const activeLook = compact || enabledLooks.includes(requestedLook) ? requestedLook : enabledLooks[0]!;
  const changeLook = (look: "clean" | "studio") => { setSelectedLook(look); if (compact) pinPreviewLook(look); };
  const studio = activeLook === "studio";
  const lightingHost = useRef<HTMLDivElement>(null);
  const [pageLighting, setPageLighting] = useState<PageStudioRenderer | null>(null);
  useEffect(() => {
    setPageLighting(null);
    if (!studio || mode === "book" || !doc) return;
    let cancelled = false;
    let renderer: PageStudioRenderer | null = null;
    void import("@/lib/portfolia/page-studio").then(module => {
      if (cancelled) return;
      if (!lightingHost.current || !panRef.current) return;
      renderer = module.createPageStudioRenderer(lightingHost.current, panRef.current);
      setPageLighting(renderer);
    }).catch(() => { /* WebGL unavailable: retain readable source pages. */ });
    return () => { cancelled = true; renderer?.dispose(); };
  }, [studio, mode, !!doc]);
  const pageStudio = useMemo<PageStudioSettings | null>(() => studio ? {
    hdri: view.studioLighting ?? "4", brightness: view.studioBrightness ?? .5,
    finish: view.finish === "textured" ? "textured" : "satin",
  } : null, [studio, view.studioLighting, view.studioBrightness, view.finish]);
  useEffect(() => { if (pageLighting && pageStudio) void pageLighting.configure(pageStudio); }, [pageLighting, pageStudio]);
  useEffect(() => {
    setZoom(mode === "scroll" ? 1.3 : 1);
  }, [mode]);
  useEffect(() => {
    if (!total) return;
    // Apply after page elements mount, in all three reading modes. Hashes remain
    // intact through password entry and work on both permanent and personal URLs.
    let frame = 0;
    const open = () => {
      const project = projectCode ? projectFromHash(window.location.hash, sections) : undefined;
      const page = project?.startPage ?? Math.min(total, Math.max(1, Number.isFinite(startPage) ? Math.floor(startPage) : 1));
      setCurrent(page);
      setJump({ page, t: Date.now() });
      if (modeLive.current === "scroll" && page > 1) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => rootRef.current?.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ block: "start" }));
      }
    };
    open();
    if (projectCode) window.addEventListener("hashchange", open);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", open); };
    // Mode changes are handled separately to preserve the visitor's current page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPage, total, sections, projectCode]);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    setJump({ page: current, t: Date.now() });
    if (mode === "scroll") rootRef.current?.querySelector(`[data-page="${current}"]`)?.scrollIntoView({ block: "start" });
  }, [mode, current]);

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

  // In the full portfolio and in full screen the icons rest out of sight and show when the mouse moves.
  // On touch screens, which have no mouse to move, they stay.
  const autoHide = showControls && (!!immersive || full);
  const [awake, setAwake] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCapable = useRef(false);
  const panelOpen = useRef(false);
  panelOpen.current = panel !== null;
  const wake = useCallback(() => {
    setAwake(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (autoHide && hoverCapable.current && !panelOpen.current) idleTimer.current = setTimeout(() => setAwake(false), 2200);
  }, [autoHide]);
  useEffect(() => {
    hoverCapable.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);
  useEffect(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!autoHide || !hoverCapable.current) setAwake(true);
    else if (full) wake();
    else setAwake(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoHide, full]);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (panel) {
      setAwake(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    } else if (wasOpen.current) wake();
    wasOpen.current = panel !== null;
  }, [panel, wake]);
  const shown = awake || !autoHide;
  const fade = shown ? "opacity-100" : "pointer-events-none opacity-0";

  // Nothing is shown until it has rendered. Another PDF or another reading mode is prepared out of sight first.
  const markReady = useCallback(() => setContentReady(true), []);
  useEffect(() => {
    setContentReady(false);
  }, [mode, source]);
  useEffect(() => {
    if (contentReady || !doc || mode === "book" || onContentReadyChange) return;
    // Safety net: never leave a visitor staring at the loader if something cannot finish.
    const t = setTimeout(() => setContentReady(true), 20000);
    return () => clearTimeout(t);
  }, [contentReady, doc, mode, onContentReadyChange]);

  // Scroll and page-by-page start below the icon bar (measured, as it can wrap on a narrow screen), so the icons
  // never sit over the top of the first page.
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar) {
      setToolbarHeight(0);
      return;
    }
    const measure = () => setToolbarHeight(bar.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [showControls, !!doc, mode]);
  const topGap = showControls ? Math.max(24, toolbarHeight + 24) : 24;
  const pagedHeight = full ? "100svh" : `var(--pf-paged-height, ${compact && !immersive ? "clamp(280px, 70svh, 600px)" : "100svh"})`;
  // A panel opens just under the icon bar (which can be two rows on a narrow screen) and may use the rest of the
  // window, with a little room left below, so its bottom never leaves the screen.
  const panelFit = { maxHeight: `calc(100svh - ${(toolbarHeight || 36) + 6 + 8 + 12}px)` };

  const quiet = tone === "dark" ? "text-white/90" : "text-slate-700";
  const togglePanel = (name: "profile" | "pages" | "projects") => setPanel((p) => (p === name ? null : name));
  const copyProject = async (id: string) => {
    if (!projectCode) return;
    const url = window.location.origin + projectPath(projectCode, id);
    try { await navigator.clipboard.writeText(url); setProjectMessage("Project link copied."); setManualProjectLink(""); }
    catch { setManualProjectLink(url); setProjectMessage("Select and copy this project link."); }
  };
  const pageArrow = (side: "left" | "right") => (
    <div className={cn("pointer-events-none absolute inset-y-0 z-30", side === "left" ? "left-0" : "right-0")}>
      <div className={cn("pointer-events-auto sticky top-[45svh]", side === "left" ? "pl-1.5" : "pr-1.5")}>
        <IconButton
          label={side === "left" ? "Previous page" : "Next page"}
          tone={tone}
          large
          disabled={side === "left" ? current <= 1 : current >= total}
          onClick={() => go(side === "left" ? -1 : 1)}
        >
          {side === "left" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
        </IconButton>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      style={pseudoFull ? { background: colour, height: "100dvh" } : { background: colour }}
      className={cn("isolate overflow-clip", pseudoFull ? "fixed inset-0 z-[200] overscroll-contain" : "relative", immersive && "min-h-[100svh]", SHOW_LOADER && !contentReady && !error && "min-h-[22rem]", credit && mode === "scroll" && "pb-8", full && "overflow-auto")}
      onPointerMove={autoHide ? wake : undefined}
      onPointerDown={autoHide ? wake : undefined}
      onKeyDown={autoHide ? wake : undefined}
      onFocusCapture={autoHide ? wake : undefined}
      onTouchStart={autoHide ? wake : undefined}
    >
      {backgroundUrl && mode !== "book" && (
        <div aria-hidden className="pointer-events-none sticky top-0 -z-10 -mb-[100svh] h-[100svh] w-full overflow-hidden">
          <img src={backgroundUrl} alt="" draggable={false} className="h-full w-full select-none object-cover" style={{ transform: fitTransform(view.backgroundFit) }} />
        </div>
      )}

      {showControls && (
        <div className="pointer-events-none sticky top-0 z-50 h-0">
          {(home || profile) && (
            <div ref={profileRef} className={cn("pointer-events-auto absolute left-3 top-3 transition-opacity duration-300", fade)}>
              <div className="flex items-center gap-2">
                {home && <LogoMark tone={tone} />}
                {profile && <IconButton label="Profile" tone={tone} pressed={panel === "profile"} onClick={() => togglePanel("profile")}>
                  {profileImageUrl && !profileImageFailed ? <img src={profileImageUrl} alt="" className="size-8 rounded-full object-cover" onError={() => setProfileImageFailed(true)} /> : <User className="size-[17px]" />}
                </IconButton>}
              </div>
              {panel === "profile" && profile && <Panel label="Profile" style={{ maxHeight: "calc(100dvh - 5rem)" }} className="mt-3 w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere] overscroll-contain">{profile}</Panel>}
            </div>
          )}
          <div ref={clusterRef} style={home || profile ? { maxWidth: "calc(100% - 7rem)" } : undefined} className={cn("pointer-events-auto absolute right-1.5 top-1.5 flex max-w-[calc(100%-0.75rem)] flex-col items-end gap-2 transition-opacity duration-300", fade)}>
            <div ref={toolbarRef} role="toolbar" aria-label="Viewer controls" className={cn("flex flex-wrap items-center justify-end gap-0.5 rounded-full p-1 shadow-sm backdrop-blur-md", tone === "dark" ? "bg-slate-950/80 text-white" : "bg-white/90 text-slate-700")}>
              {doc && availableModes.length > 1 && (
                <div role="radiogroup" aria-label="Reading mode" className="flex items-center">
                  {MODES.filter(([m]) => availableModes.includes(m)).map(([m, label, Icon]) => (
                    <IconButton key={m} label={label} tone={tone} checked={mode === m} onClick={() => setMode(m)}>
                      <Icon className="size-[17px]" />
                    </IconButton>
                  ))}
                </div>
              )}
              {doc && (
                <IconButton label="Pages" tone={tone} pressed={panel === "pages"} onClick={() => togglePanel("pages")}>
                  <LayoutGrid className="size-[17px]" />
                </IconButton>
              )}
              {sections.length > 0 && (
                <IconButton label="Projects" tone={tone} pressed={panel === "projects"} onClick={() => togglePanel("projects")}>
                  <List className="size-[17px]" />
                </IconButton>
              )}
              {/* The flipbook shows its own page number at the bottom, so it is not repeated here. */}
              {doc && mode !== "book" && (
                <span className={cn("hidden px-1 text-[11px] tabular-nums sm:inline", quiet)} aria-live="polite">
                  {current} / {doc.numPages}
                </span>
              )}
              {doc && (
                <IconButton label="Zoom out" tone={tone} onClick={() => z(-zoomStep)} disabled={zoom <= 1}>
                  <ZoomOut className="size-[17px]" />
                </IconButton>
              )}
              {doc && (
                <button type="button" onClick={() => setZoom(mode === "scroll" ? 1.3 : 1)} aria-label="Reset zoom" className={cn("hidden w-10 rounded-full py-1 text-center text-[11px] tabular-nums transition-colors sm:inline", quiet, tone === "dark" ? "hover:text-white" : "hover:text-black")}>
                  {Math.round(zoom * 100)}%
                </button>
              )}
              {doc && (
                <IconButton label="Zoom in" tone={tone} onClick={() => z(zoomStep)} disabled={zoom >= 3}>
                  <ZoomIn className="size-[17px]" />
                </IconButton>
              )}
              <IconButton label={full ? "Exit full screen" : "Full screen"} tone={tone} onClick={() => void toggleFull()}>
                {full ? <Minimize2 className="size-[17px]" /> : <Maximize2 className="size-[17px]" />}
              </IconButton>
              {allowDownload && downloadUrl && (
                <a href={downloadUrl} download={fileName} onClick={onDownload} aria-label="Download PDF" title="Download PDF" className={iconClass(tone)}>
                  <Download className="size-[17px]" />
                </a>
              )}
            </div>
            {panel === "projects" && doc && (
              <Panel label="Projects" style={panelFit} className="w-[min(24rem,calc(100vw-1.5rem))] max-w-full overflow-auto overscroll-contain">
                <h2 className="mb-3 text-sm font-medium">Projects</h2>
                <ol className="space-y-2">
                  {sections.map((project) => (
                    <li key={project.id} className="flex items-center gap-1 rounded-xl border border-border p-1">
                      <button type="button" onClick={() => { jumpTo(project.startPage); setPanel(null); }} aria-current={current >= project.startPage && current <= project.endPage ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2 aria-[current=true]:bg-muted">
                        <div aria-hidden className="pointer-events-none w-16 shrink-0 overflow-hidden rounded border border-border">
                          <PdfPage doc={doc} n={project.startPage} size={sizes[project.startPage - 1]!} zoom={0} onVisible={noop} thumb />
                        </div>
                        <span className="min-w-0"><span className="block break-words text-sm font-medium">{project.title}</span><span className="mt-1 block text-xs text-muted-foreground">{project.startPage === project.endPage ? `Page ${project.startPage}` : `Pages ${project.startPage}–${project.endPage}`}</span></span>
                      </button>
                      {projectCode && <button type="button" aria-label={`Copy link to ${project.title}`} title={`Copy link to ${project.title}`} onClick={() => void copyProject(project.id)} className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2"><Copy className="size-4" /></button>}
                    </li>
                  ))}
                </ol>
                <p role="status" className="mt-2 text-xs text-muted-foreground">{projectMessage}</p>
                {manualProjectLink && <input aria-label="Project link" readOnly value={manualProjectLink} onFocus={(e) => e.target.select()} className="mt-2 w-full rounded border p-2 text-xs" />}
              </Panel>
            )}
            {panel === "pages" && doc && (
              <Panel label="Pages" style={panelFit} className="w-[min(24rem,calc(100vw-1.5rem))] max-w-full overflow-auto overscroll-contain">
                <div className="grid grid-cols-4 gap-2">
                  {sizes.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        jumpTo(i + 1);
                        setPanel(null);
                      }}
                      aria-label={`Go to page ${i + 1}`}
                      aria-current={current === i + 1 ? "page" : undefined}
                      className={cn("rounded-md p-0.5 text-xxs text-muted-foreground", current === i + 1 ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border")}
                    >
                      <div className="pointer-events-none w-full">
                        <PdfPage doc={doc} n={i + 1} size={s} zoom={0} onVisible={noop} eager thumb />
                      </div>
                      <span className="block pt-0.5 tabular-nums">{i + 1}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}

      {error ? (
        <div className="px-6 py-20 text-center text-sm">
          <p className={cn("font-medium", tone === "dark" ? "text-white" : "text-black")}>This portfolio couldn’t be displayed</p>
          <p className={cn("mt-1", quiet)}>{error}</p>
        </div>
      ) : !doc ? (
        SHOW_LOADER ? null : (
          <div role="status" className="mx-auto max-w-xs px-6 py-24 text-center text-sm">
            <p className={quiet}>Loading portfolio…{progress > 0 && progress < 100 ? ` ${progress}%` : ""}</p>
            <Progress value={progress} className="mt-3 h-1" />
          </div>
        )
      ) : (
        <div className={cn("relative transition-opacity duration-300", shownReady ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!shownReady}>
      {mode === "book" ? (
        <BookView demoNotes={demoNotes} foldouts={foldouts} tags={tags} links={links} doc={doc} sizes={sizes} zoom={zoom} onZoomChange={setZoom} jump={jump} onPage={setCurrent} viewer={{ ...view, look: activeLook }} onLookChange={changeLook} colour={colour} backgroundUrl={backgroundUrl} tone={tone} immersive={immersive} fullscreen={full} awake={shown} onReadyChange={bookReadyChanged} onRenderError={bookRenderError} autoTurn={autoTurn} autoTurnDelay={autoTurnDelay} fullSpread={fullSpread} lightweight={lightweight} previewable={compact} />
      ) : mode === "paged" ? (
        <div ref={pagedRef} className="relative" style={{ height: pagedHeight, touchAction: zoom > 1 ? "pan-x pan-y" : "pan-y" }}>
          <div ref={panRef} className="h-full overflow-auto" style={{ overflowX: zoom > 1 ? "auto" : "hidden", cursor: zoom > 1 ? "grab" : undefined }}>
            <div
              className="flex min-h-full items-center justify-center px-3 sm:px-8"
              style={{ paddingTop: topGap, paddingBottom: 24, alignItems: "safe center", justifyContent: "safe center" }}
            >
              {sizes[current - 1] && (
                <div className="shrink-0" style={{ width: `calc(min(100%, max(1px, calc((${pagedHeight} - ${topGap + 24}px) * ${sizes[current - 1]!.w / sizes[current - 1]!.h}))) * ${zoom})` }}>
                <PdfPage slide doc={doc} n={current} size={sizes[current - 1]!} lighting={pageLighting} zoom={zoom} onVisible={noop} eager onRendered={markReady} />
                </div>
              )}
            </div>
          </div>
          {showControls && (
            <>
              {pageArrow("left")}
              {pageArrow("right")}
            </>
          )}
        </div>
      ) : (
        <div ref={panRef} className="overflow-auto" style={{ height: pagedHeight, cursor: zoom > 1 ? "grab" : undefined, touchAction: "pan-x pan-y pinch-zoom" }}>
          <div
            className={cn("mx-auto flex flex-col gap-4 pb-6", compact ? "px-3" : "px-3 sm:px-8")}
            style={{ paddingTop: topGap, width: `calc(min(100%, ${compact ? 900 : 1100}px) * ${zoom})` }}
          >
            {sizes.map((s, i) => (
              <PdfPage key={i} doc={doc} n={i + 1} size={s} lighting={pageLighting} zoom={zoom} onVisible={setCurrent} onRendered={i === 0 ? markReady : undefined} />
            ))}
          </div>
        </div>
      )}
      {mode !== "book" && studio && <div ref={lightingHost} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />}
        </div>
      )}

      {mode !== "book" && enabledLooks.length > 1 && showControls && (
        <div className="absolute bottom-1.5 right-1.5 z-30 w-36 rounded-full bg-background/90 shadow-soft backdrop-blur">
          <Segmented label="Page appearance" value={activeLook} options={[["clean", "Simple"], ["studio", "Studio"]] as const} onChange={changeLook} />
        </div>
      )}

      {credit && (
        <p className={cn("pointer-events-none absolute inset-x-0 bottom-1.5 z-10 text-center text-xxs", tone === "dark" ? "text-white/45" : "text-black/40")}>
          Hosted on <span className={cn("display-title text-xs", tone === "dark" ? "text-white/75" : "text-black/65")}>Portfolia</span>
        </p>
      )}

      {SHOW_LOADER && !error && (
        <div
          aria-hidden={contentReady}
          className={cn("absolute inset-0 z-40 transition-opacity duration-300", contentReady ? "pointer-events-none opacity-0" : "opacity-100")}
          style={{ background: colour }}
        >
          {/* Pinned in view, so it is centred on screen even when the (hidden) pages below are very tall. */}
          <div className="sticky top-0 flex h-[100svh] max-h-full items-center justify-center">
            {/* Small covers (the library) show just the little book, without words. */}
            <BookLoader tone={tone} label="" />
          </div>
        </div>
      )}
    </div>
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
  onRendered,
  lighting,
  slide,
}: {
  slide?: boolean;
  lighting?: PageStudioRenderer | null;
  thumb?: boolean;
  /** Called once the page has been drawn, so the viewer knows when it can show it. */
  onRendered?: () => void;
  doc: PDFDocumentProxy;
  n: number;
  size: { w: number; h: number };
  zoom: number;
  onVisible: (n: number) => void;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shownPage = useRef<{ doc: PDFDocumentProxy; n: number } | null>(null);
  const rendered = useRef(onRendered);
  rendered.current = onRendered;
  const [near, setNear] = useState(eager || n <= 2);
  const [failed, setFailed] = useState(false);
  const [renderWidth, setRenderWidth] = useState(0);
  const artwork = useRef<HTMLCanvasElement | null>(null);
  const requestedPage = useRef({ doc, n });
  requestedPage.current = { doc, n };
  const presentedPage = useRef<{ doc: PDFDocumentProxy; n: number } | null>(null);
  const activeLighting = useRef(lighting);
  activeLighting.current = lighting;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!lighting || !el || thumb) return;
    if (artwork.current) lighting.present(el, artwork.current, () => slide && artwork.current?.parentElement ? { layer: artwork.current.parentElement, direction: 1, animate: false } : undefined);
    else el.style.background = "transparent";
    return () => lighting.remove(el);
  }, [lighting, thumb]);
  const present = (canvas: HTMLCanvasElement, layers: HTMLElement[], current: () => boolean, animate = false) => {
    const el = ref.current;
    if (!el) return;
    const commit = (live = false) => {
      const layer = document.createElement("div");
      layer.className = "absolute inset-0";
      layer.append(canvas, ...layers);
      el.replaceChildren(layer);
      artwork.current = canvas;
      const changed = presentedPage.current !== null && (presentedPage.current.doc !== doc || presentedPage.current.n !== n);
      const direction = presentedPage.current && n < presentedPage.current.n ? -1 : 1;
      presentedPage.current = { doc, n };
      const moving = Boolean(animate && changed && slide && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (moving && !live) {
        layer.animate([{ transform: `translateX(${direction * READER_SLIDE_DISTANCE * 100}%)` }, { transform: "translateX(0)" }], { duration: READER_SLIDE_MS, easing: "cubic-bezier(.215,.61,.355,1)" });
      }
      rendered.current?.();
      return slide ? { layer, direction: direction as 1 | -1, animate: moving } : undefined;
    };
    if (!thumb && activeLighting.current) activeLighting.current.present(el, canvas, commit, current);
    else if (current()) commit();
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setRenderWidth(Math.round(el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    if (!el || (shownPage.current?.doc === doc && shownPage.current.n === n)) return;
    shownPage.current = { doc, n };
    setFailed(false);
    const copy = cachedCopy(doc, n);
    // Keep the current single page until its replacement is fully rendered/lit.
    if (copy) present(copy, [], () => ref.current === el && requestedPage.current.doc === doc && requestedPage.current.n === n, true);
    else if (!slide) { el.replaceChildren(); artwork.current = null; }
  }, [doc, n]);

  useEffect(() => {
    if (!near || !renderWidth) return;
    const el = ref.current!;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const page = await doc.getPage(n);
        const cssW = renderWidth;
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
        present(canvas, [text, links], () => !cancelled && ref.current === el && requestedPage.current.doc === doc && requestedPage.current.n === n, true);
        el.style.setProperty("--scale-factor", String(scale));
        el.style.setProperty("--total-scale-factor", String(scale));
      } catch (e) {
        if (!cancelled && (e as { name?: string })?.name !== "RenderingCancelledException") {
          setFailed(true);
          rendered.current?.();
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, doc, n, size.w, zoom, renderWidth]);

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
