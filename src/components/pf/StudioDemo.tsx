import { registerPublicUrls } from "@/lib/portfolia/assets";
import { chooseHomeExample } from "@/lib/portfolia/homepage-examples";
import { FIELD_NOTES_CODE, fieldNotesExample } from "@/lib/portfolia/field-notes-example";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfViewer } from "./PdfViewer";
import { BookLoader } from "./book-loader";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";
import type { PublicPortfolio } from "@/lib/portfolia/public.functions";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";

// Explicitly selected by the site owner. Never select an arbitrary account or draft.
export const FEATURED_PORTFOLIO_CODE = "adu2v";
export const FEATURED_CREDIT = "Property of Scarlett Bushell 2026";
const demoRequests = new Map<string, { at: number; promise: Promise<PublicPortfolio> }>();
function loadDemoPortfolio(code: string, refresh = false) {
  void loadPdfjs().catch(() => {});
  // The site's own example ships with the site: nothing to fetch from an account.
  if (code === FIELD_NOTES_CODE) return Promise.resolve<PublicPortfolio>(fieldNotesExample());
  let request = demoRequests.get(code);
  if (refresh || !request || Date.now() - request.at > 60000) {
    const promise = getPublicPortfolio({ data: { by: "code", value: code } });
    request = { at: Date.now(), promise }; demoRequests.set(code, request);
    void promise.catch(() => { if (demoRequests.get(code)?.promise === promise) demoRequests.delete(code); });
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
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const figure = useRef<HTMLElement>(null);
  const readyChanged = useCallback((ready: boolean) => { if (ready) setRendered(true); }, []);
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
    setSlow(false);
    setData(null);
    const timeout = setTimeout(() => { cancelled = true; setState("error"); }, 30000);
    void loadDemoPortfolio(exampleCode, attempt > 0).then((result) => {
      if (cancelled) return;
      clearTimeout(timeout);
      if (result) registerPublicUrls(result.urls);
      setData(result);
      setState((result?.portfolio.pdf && result.urls[result.portfolio.pdf.blobKey]) ? "ready" : "error");
    }).catch(() => { clearTimeout(timeout); if (!cancelled) setState("error"); });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [attempt, exampleCode]);
  useEffect(() => {
    if (state !== "ready" || rendered) { setSlow(false); return; }
    const timeout = setTimeout(() => setSlow(true), 60000);
    return () => clearTimeout(timeout);
  }, [state, rendered, attempt]);
  const p = data?.portfolio;
  const url = p?.pdf && data?.urls[p.pdf.blobKey];
  const source = useMemo(() => url ? { url } : null, [url]);
  const stop = () => setInteracted(true);
  return <figure ref={figure} onPointerDownCapture={stop} onKeyDownCapture={stop} onWheelCapture={stop} className={className ?? "mx-auto w-full max-w-5xl"}>
    <div className={workspace ? "pf-workspace-demo relative h-full overflow-hidden" : "pf-home-demo relative overflow-hidden rounded-3xl border border-border shadow-lift [&_.pf-book-viewport]:h-[28rem] sm:[&_.pf-book-viewport]:h-[36rem] lg:[&_.pf-book-viewport]:h-[40rem]"} style={{ background: p?.viewer?.backgroundColor ?? "#02011e" }}>
      {state === "ready" && p?.pdf && source && <div style={{ opacity: rendered ? 1 : 0, pointerEvents: rendered ? "auto" : "none" }} aria-hidden={!rendered} inert={!rendered}>
      <PdfViewer
        source={source}
        fileName={p.pdf.name}
        viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", look: "studio", studioBrightness: Math.min(1, (p.viewer?.studioBrightness ?? 0.5) + 0.14), modes: workspace ? ["book", "scroll", "paged"] : ["book"], looks: ["clean", "studio"] }}
        backgroundUrl={p.viewer?.backgroundKey ? data?.urls[p.viewer.backgroundKey] : undefined}
        controls
        homepageExample={workspace}
        allowDownload={p.allowDownload}
        projects={p.pdf.projects} foldouts={p.pdf.foldouts} tags={p.pdf.tags} links={p.pdf.links} videos={p.pdf.videos} spotlights={p.pdf.spotlights} projectCode={p.code}
        lightweight={!workspace}
        initialLook="studio"
        fullSpread
        autoTurnDelay={1600}
        autoTurn={rendered && visible && motionAllowed && !interacted}
        onBookReadyChange={readyChanged}
        onLoadError={loadError}
      /></div>}
      {(!rendered || state === "error") && <div role="status" className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 px-6 text-center text-sm text-white/90`}>
        {state !== "error" && <BookLoader tone="dark" label="" />}
        {(state === "error" || slow) && <p>{state === "error" ? "The example is temporarily unavailable." : "This is taking longer than usual. You can wait or try again."}</p>}
        {(state === "error" || slow) && <button type="button" className="underline underline-offset-4" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
      </div>}
    </div>
    {!workspace && <figcaption className="mt-3 text-center text-xs text-muted-foreground">{FEATURED_CREDIT}</figcaption>}
  </figure>;
}
