import { registerPublicUrls } from "@/lib/portfolia/assets";
import { FIELD_NOTES_PUBLISHED_CODE, HOME_EXAMPLE_START_PAGE, LOOKBOOK_CODE, chooseHomeExample } from "@/lib/portfolia/homepage-examples";
import { FIELD_NOTES_CODE, fieldNotesExample } from "@/lib/portfolia/field-notes-example";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfViewer } from "./PdfViewer";
import { createHomeLookCycle, type HomeDemoLook } from "@/lib/portfolia/home-look-cycle";
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
  const [shownLook, setShownLook] = useState<HomeDemoLook>("simple");
  const [warmStudio, setWarmStudio] = useState(false);
  const [pageActive, setPageActive] = useState(true);
  const tourStarted = useRef<number | undefined>(undefined);
  const [studioFailed, setStudioFailed] = useState(false);
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
    const update = () => { setPageActive(!document.hidden); setMotionAllowed(!preference.matches && !document.hidden); };
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
    setShownLook("simple");
    setWarmStudio(false);
    tourStarted.current = undefined;
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
  // Simple starts its own tour immediately; Studio warms independently behind it.
  const simpleChanged = useCallback((ready: boolean) => { if (ready) { tourStarted.current ??= performance.now(); setSimpleReady(true); } }, []);
  const cycle = useMemo(() => createHomeLookCycle(setShownLook), [attempt, exampleCode]);
  useEffect(() => { cycle.setActive(workspace && state === "ready" && visible && pageActive && !interacted); return () => cycle.pause(); }, [cycle, workspace, state, visible, pageActive, interacted]);
  useEffect(() => { cycle.setReady(rendered && !studioFailed); }, [cycle, rendered, studioFailed]);
  useEffect(() => {
    if (!workspace || !simpleReady || warmStudio) return;
    let frame = 0, idle: number | undefined, fallback: ReturnType<typeof setTimeout> | undefined;
    // Yield two browser frames so Simple and its moving backdrop are already presented.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      if (window.requestIdleCallback) idle = window.requestIdleCallback(() => setWarmStudio(true), { timeout: 1500 });
      else fallback = setTimeout(() => setWarmStudio(true), 0);
    }); });
    return () => { cancelAnimationFrame(frame); if (idle !== undefined) window.cancelIdleCallback(idle); clearTimeout(fallback); };
  }, [workspace, simpleReady, warmStudio]);
  const studioActive = !workspace || (shownLook === "studio" && rendered && !studioFailed);
  const simpleActive = workspace && !studioActive;
  const displayed = workspace ? simpleReady : rendered;
  const tourActive = workspace && simpleReady && visible && motionAllowed && !interacted;
  const stop = (e: { target: EventTarget | null }) => {
    // Scrolling the homepage does not stop the showcase.
    if (e.target instanceof Element && e.target.closest("[data-demo-guidance]")) return;
    setInteracted(true);
    cycle.pause();
  };
  return <figure ref={figure} onFocusCapture={stop} onPointerDownCapture={stop} onKeyDownCapture={e => { if (e.key !== "Tab") stop(e); }} className={className ?? "mx-auto w-full max-w-5xl"}>
    <div className={workspace ? "pf-workspace-demo relative h-full overflow-hidden [&:has([data-fullscreen=true])_[data-demo-guidance]]:hidden" : "pf-home-demo relative overflow-hidden rounded-3xl border border-border shadow-lift [&_.pf-book-viewport]:h-[28rem] sm:[&_.pf-book-viewport]:h-[36rem] lg:[&_.pf-book-viewport]:h-[40rem]"}>
      {state === "ready" && p?.pdf && source && (!workspace || warmStudio) && <div data-demo-studio data-active={studioActive} className={workspace ? "pf-demo-look absolute inset-0" : undefined} style={{ opacity: rendered && studioActive ? 1 : 0, visibility: rendered && studioActive ? "visible" : "hidden", pointerEvents: studioActive ? "auto" : "none" }} aria-hidden={!studioActive} inert={!studioActive}>
      <PdfViewer
        source={source}
        fileName={p.pdf.name}
        viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", look: "studio", studioBrightness: Math.min(1, (p.viewer?.studioBrightness ?? 0.5) + 0.14), modes: workspace ? ["book", "scroll", "paged"] : ["book"], looks: ["clean", "studio"] }}
        startPage={workspace ? HOME_EXAMPLE_START_PAGE : undefined}
        backgroundUrl={p.viewer?.backgroundKey ? data?.urls[p.viewer.backgroundKey] : undefined}
        controls
        homepageExample={workspace}
        presentationActive={studioActive}
        loadingIndicator={false}
        allowDownload={p.allowDownload}
        projects={p.pdf.projects} foldouts={p.pdf.foldouts} tags={p.pdf.tags} links={p.pdf.links} videos={p.pdf.videos} spotlights={p.pdf.spotlights} jumps={p.pdf.jumps} stickers={p.pdf.stickers} hotspots={p.pdf.hotspots} slideshows={p.pdf.slideshows} projectCode={p.code}
        lightweight={!workspace}
        initialLook="studio"
        fullSpread
        autoTurnDelay={1600}
        autoTurn={!workspace && rendered && visible && motionAllowed && !interacted}
        showcaseOrbit={tourActive && studioActive}
        showcaseOrbitStart={tourStarted.current}
        onBookReadyChange={workspace ? undefined : readyChanged}
        onDemoReady={workspace ? studioRendered : undefined}
        onLoadError={workspace ? studioError : loadError}
      /></div>}
      {workspace && state === "ready" && p?.pdf && source && <div data-demo-simple data-active={simpleActive} className="pf-demo-look absolute inset-0" style={{ opacity: simpleActive ? 1 : 0, visibility: simpleActive ? "visible" : "hidden", pointerEvents: simpleActive ? "auto" : "none" }} aria-hidden={!simpleActive} inert={!simpleActive}>
        {/* Simple is a fully working reader while Studio prepares independently. */}
        <PdfViewer
          source={source}
          fileName={p.pdf.name}
          viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", look: "clean", modes: ["book"], looks: ["clean"] }}
          startPage={HOME_EXAMPLE_START_PAGE}
          controls
          allowDownload={p.allowDownload}
          backgroundUrl={p.viewer?.backgroundKey ? data?.urls[p.viewer.backgroundKey] : undefined}
          presentationActive={simpleActive}
          pageNumber={false}
          homepageExample
          loadingIndicator={false}
          projects={p.pdf.projects} foldouts={p.pdf.foldouts} tags={p.pdf.tags} links={p.pdf.links} spotlights={p.pdf.spotlights} jumps={p.pdf.jumps} stickers={p.pdf.stickers} hotspots={p.pdf.hotspots} slideshows={p.pdf.slideshows}
          videos={p.pdf.videos}
          projectCode={p.code}
          initialLook="clean"
          fullSpread
          showcaseOrbit={tourActive && simpleActive}
          showcaseOrbitStart={tourStarted.current}
          onBookReadyChange={simpleChanged}
          onLoadError={loadError}
        />
      </div>}
      {workspace && displayed && state === "ready" && <p id="demo-guide" data-demo-guidance className="pointer-events-none absolute inset-x-3 bottom-16 z-30 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-2xl bg-background/90 px-3 py-1.5 text-center text-[11px] leading-snug text-foreground shadow-soft sm:bottom-20">
        Go full screen to view the full flipbook.
      </p>}
      {(!displayed || state === "error") && <div role="status" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center text-sm text-foreground">
        {state !== "error" && <BookLoader tone="light" label="" />}
        {(state === "error" || slow) && <p>{state === "error" ? "The example is temporarily unavailable." : "This is taking longer than usual. You can wait or try again."}</p>}
        {(state === "error" || slow) && <Button variant="ghost" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
      </div>}
    </div>
    {!workspace && <figcaption className="mt-3 text-center text-xs text-muted-foreground">{FEATURED_CREDIT}</figcaption>}
  </figure>;
}
