import { registerPublicUrls } from "@/lib/portfolia/assets";
import { FIELD_NOTES_PUBLISHED_CODE, HOME_EXAMPLE_START_PAGE, LOOKBOOK_CODE, chooseHomeExample } from "@/lib/portfolia/homepage-examples";
import { FIELD_NOTES_CODE, fieldNotesExample } from "@/lib/portfolia/field-notes-example";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfViewer } from "./PdfViewer";
import { LookCompare } from "./LookCompare";
import { BookLoader } from "./book-loader";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";
import type { PublicPortfolio } from "@/lib/portfolia/public.functions";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";
import { Button } from "@/components/ui/button";

// Explicitly selected by the site owner. Never select an arbitrary account or draft.
export const FEATURED_PORTFOLIO_CODE = "adu2v";
export const FEATURED_CREDIT = "Property of Scarlett Bushell 2026";
const demoRequests = new Map<string, { at: number; promise: Promise<PublicPortfolio> }>();
function loadDemoPortfolio(code: string, refresh = false, fallback = false) {
  void loadPdfjs().catch(() => {});
  // The site's own example ships with the site: nothing to fetch from an account.
  if (code === FIELD_NOTES_CODE) return Promise.resolve<PublicPortfolio>(fieldNotesExample());
  const key = `${code}|${fallback}`;
  let request = demoRequests.get(key);
  if (refresh || !request || Date.now() - request.at > 60000) {
    const published = getPublicPortfolio({ data: { by: "code", value: code } });
    // The homepage's lookbook and the published Field Notes fall back to the Field Notes copy shipped with the site,
    // so the homepage always has an example even when a published book can't be reached.
    const promise = code === FIELD_NOTES_PUBLISHED_CODE || (fallback && code === LOOKBOOK_CODE) ? published.then((result) => result ?? fieldNotesExample(), () => fieldNotesExample()) : published;
    request = { at: Date.now(), promise }; demoRequests.set(key, request);
    void promise.catch(() => { if (demoRequests.get(key)?.promise === promise) demoRequests.delete(key); });
  }
  return request.promise;
}
export function loadFeaturedPortfolio(refresh = false) { return loadDemoPortfolio(FEATURED_PORTFOLIO_CODE, refresh); }


/** Reuse the real reader and saved settings instead of drawing invented sample pages. */
export function StudioDemo({ className, workspace = false }: { className?: string; workspace?: boolean }) {
  const [exampleCode, setExampleCode] = useState<string | null>(workspace ? null : FEATURED_PORTFOLIO_CODE);
  const chosen = useRef<string | null>(null);
  useEffect(() => { if (workspace) { chosen.current ??= chooseHomeExample(); setExampleCode(chosen.current); } else setExampleCode(FEATURED_PORTFOLIO_CODE); }, [workspace]);
  const [data, setData] = useState<PublicPortfolio>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [slow, setSlow] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [readerLook, setReaderLook] = useState<"simple" | "studio" | null>(null);
  const [studioFailed, setStudioFailed] = useState(false);
  const [comparing, setComparing] = useState(workspace);
  const [simpleReady, setSimpleReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const figure = useRef<HTMLElement>(null);
  const readyChanged = useCallback((ready: boolean) => { if (ready) setRendered(true); }, []);
  const studioRendered = useCallback(() => setRendered(true), []);
  const studioError = useCallback(() => setStudioFailed(true), []);
  const loadError = useCallback(() => setState("error"), []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!preference.matches && !document.hidden);
    update();
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.2 });
    if (figure.current) observer.observe(figure.current);
    return () => { observer.disconnect(); preference.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!exampleCode) return;
    let cancelled = false;
    setState("loading");
    setRendered(false);
    setSimpleReady(false);
    setStudioFailed(false);
    setReaderLook(null);
    setComparing(workspace);
    setInteracted(false);
    setSlow(false);
    setData(null);
    const timeout = setTimeout(() => { cancelled = true; setState("error"); }, 30000);
    void loadDemoPortfolio(exampleCode, attempt > 0, workspace).then((result) => {
      if (cancelled) return;
      clearTimeout(timeout);
      if (result) registerPublicUrls(result.urls);
      setData(result);
      setState((result?.portfolio.pdf && result.urls[result.portfolio.pdf.blobKey]) ? "ready" : "error");
    }).catch(() => { clearTimeout(timeout); if (!cancelled) setState("error"); });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [attempt, exampleCode, workspace]);
  useEffect(() => {
    if (state !== "ready" || (workspace ? simpleReady : rendered)) { setSlow(false); return; }
    const timeout = setTimeout(() => setSlow(true), 60000);
    return () => clearTimeout(timeout);
  }, [state, rendered, simpleReady, workspace, attempt]);
  const p = data?.portfolio;
  const url = p?.pdf && data?.urls[p.pdf.blobKey];
  const source = useMemo(() => url ? { url } : null, [url]);
  // Homepage only: Simple covers Studio until its final frame is ready, then the divider enters once.
  const simpleChanged = useCallback((ready: boolean) => { if (ready) setSimpleReady(true); }, []);
  const showCompare = comparing && rendered && simpleReady && !studioFailed && state === "ready";
  const simpleActive = workspace && (comparing || readerLook === "simple");
  const displayed = workspace ? simpleReady : rendered;
  // Start both cameras together after Studio warms up, keeping the comparison aligned.
  const tourActive = workspace && showCompare && visible && motionAllowed && !interacted;
  const insideSlider = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("[data-compare-slider]"));
  const stop = (e: { target: EventTarget | null }) => {
    // Dragging the line is comparing; anything else with the book means the reader is reading.
    if (insideSlider(e.target)) return;
    // Scrolling the homepage does not end the comparison or change the visible look.
    if (e.target instanceof Element && e.target.closest("[data-demo-guidance]")) return;
    setInteracted(true);
    if (readerLook === null) setReaderLook(showCompare || !workspace ? "studio" : "simple");
    setComparing(false);
  };
  return <figure ref={figure} onPointerDownCapture={stop} onKeyDownCapture={e => { if (e.key !== "Tab") stop(e); }} className={className ?? "mx-auto w-full max-w-5xl"}>
    <div className={workspace ? "pf-workspace-demo relative h-full overflow-hidden [&:has([data-fullscreen=true])_[data-demo-guidance]]:hidden" : "pf-home-demo relative overflow-hidden rounded-3xl border border-border shadow-lift [&_.pf-book-viewport]:h-[28rem] sm:[&_.pf-book-viewport]:h-[36rem] lg:[&_.pf-book-viewport]:h-[40rem]"}>
      {state === "ready" && p?.pdf && source && (!workspace || simpleReady) && <div data-demo-studio style={{ opacity: rendered ? 1 : 0, pointerEvents: rendered && (!simpleActive || showCompare) ? "auto" : "none" }} aria-hidden={!rendered || (simpleActive && !showCompare)} inert={!rendered || (simpleActive && !showCompare)}>
      <PdfViewer
        source={source}
        fileName={p.pdf.name}
        viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", look: "studio", studioBrightness: Math.min(1, (p.viewer?.studioBrightness ?? 0.5) + 0.14), modes: workspace ? ["book", "scroll", "paged"] : ["book"], looks: comparing ? ["studio"] : ["clean", "studio"] }}
        startPage={workspace ? HOME_EXAMPLE_START_PAGE : undefined}
        backgroundUrl={p.viewer?.backgroundKey ? data?.urls[p.viewer.backgroundKey] : undefined}
        controls
        homepageExample={workspace}
        loadingIndicator={false}
        allowDownload={p.allowDownload}
        projects={p.pdf.projects} foldouts={p.pdf.foldouts} tags={p.pdf.tags} links={p.pdf.links} videos={p.pdf.videos} spotlights={p.pdf.spotlights} jumps={p.pdf.jumps} stickers={p.pdf.stickers} hotspots={p.pdf.hotspots} slideshows={p.pdf.slideshows} projectCode={p.code}
        lightweight={!workspace}
        initialLook="studio"
        fullSpread
        autoTurnDelay={1600}
        autoTurn={rendered && visible && motionAllowed && !interacted && !comparing}
        showcaseOrbit={tourActive}
        onBookReadyChange={workspace ? undefined : readyChanged}
        onDemoReady={workspace ? studioRendered : undefined}
        onLoadError={workspace ? studioError : loadError}
      /></div>}
      {workspace && state === "ready" && p?.pdf && source && <LookCompare show={showCompare} active={simpleActive} motion={motionAllowed}>
        {/* The same book in the Simple look, framed identically and showing the same spread; it only ever shows, never takes input. */}
        <PdfViewer
          source={source}
          fileName={p.pdf.name}
          viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", look: "clean", modes: ["book"], looks: ["clean"] }}
          startPage={HOME_EXAMPLE_START_PAGE}
          controls={!showCompare}
          pageNumber={false}
          homepageExample
          loadingIndicator={false}
          projects={p.pdf.projects} foldouts={p.pdf.foldouts} tags={p.pdf.tags} links={p.pdf.links} spotlights={p.pdf.spotlights} jumps={p.pdf.jumps} stickers={p.pdf.stickers} hotspots={p.pdf.hotspots} slideshows={p.pdf.slideshows}
          initialLook="clean"
          fullSpread
          showcaseOrbit={tourActive}
          onBookReadyChange={simpleChanged}
          onLoadError={loadError}
        />
      </LookCompare>}
      {workspace && displayed && state === "ready" && <p id="demo-guide" data-demo-guidance className="pointer-events-none absolute inset-x-3 bottom-16 z-30 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-2xl bg-background/90 px-3 py-1.5 text-center text-[11px] leading-snug text-foreground shadow-soft sm:bottom-20">
        {showCompare
          ? <>Drag the line to compare. Go full screen to view the full flipbook.</>
          : <>Go full screen to view the full flipbook.</>}
      </p>}
      {(!displayed || state === "error") && <div role="status" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center text-sm text-foreground">
        {state !== "error" && <BookLoader tone="dark" label="" />}
        {(state === "error" || slow) && <p>{state === "error" ? "The example is temporarily unavailable." : "This is taking longer than usual. You can wait or try again."}</p>}
        {(state === "error" || slow) && <Button variant="ghost" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
      </div>}
    </div>
    {!workspace && <figcaption className="mt-3 text-center text-xs text-muted-foreground">{FEATURED_CREDIT}</figcaption>}
  </figure>;
}
