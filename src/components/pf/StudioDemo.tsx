import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfViewer } from "./PdfViewer";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";
import type { PublicPortfolio } from "@/lib/portfolia/public.functions";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";

// Explicitly selected by the site owner. Never select an arbitrary account or draft.
export const FEATURED_PORTFOLIO_CODE = "adu2v";
export const FEATURED_CREDIT = "Property of Scarlett Bushell 2026";

/** Reuse the real reader and saved settings instead of drawing invented sample pages. */
export function StudioDemo({ className }: { className?: string }) {
  const [data, setData] = useState<PublicPortfolio>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
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
    let cancelled = false;
    setState("loading");
    setRendered(false);
    void getPublicPortfolio({ data: { by: "code", value: FEATURED_PORTFOLIO_CODE } }).then((result) => {
      if (cancelled) return;
      setData(result);
      setState((result?.portfolio.pdf && result.urls[result.portfolio.pdf.blobKey]) ? "ready" : "error");
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [attempt]);
  const p = data?.portfolio;
  const url = p?.pdf && data?.urls[p.pdf.blobKey];
  const source = useMemo(() => url ? { url } : null, [url]);
  const stop = () => setInteracted(true);
  return <figure ref={figure} onPointerDownCapture={stop} onKeyDownCapture={stop} onWheelCapture={stop} className={className ?? "mx-auto w-full max-w-5xl"}>
    <div className="relative overflow-hidden rounded-3xl border border-border shadow-lift [&_.pf-book-viewport]:h-[28rem] sm:[&_.pf-book-viewport]:h-[36rem] lg:[&_.pf-book-viewport]:h-[40rem]" style={{ background: p?.viewer?.backgroundColor ?? "#02011e" }}>
      {state === "ready" && p?.pdf && source && <div style={{ opacity: rendered ? 1 : 0, pointerEvents: rendered ? "auto" : "none" }} aria-hidden={!rendered} inert={!rendered}>
      <PdfViewer
        source={source}
        fileName={p.pdf.name}
        viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", look: "studio", modes: ["book"], looks: ["clean", "studio"] }}
        backgroundUrl={p.viewer?.backgroundKey ? data?.urls[p.viewer.backgroundKey] : undefined}
        controls
        autoTurn={rendered && visible && motionAllowed && !interacted}
        onBookReadyChange={readyChanged}
        onLoadError={loadError}
      /></div>}
      {(!rendered || state === "error") && <div role="status" className={`${state === "ready" ? "absolute inset-0" : "h-[28rem]"} flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80`}>
        <p>{state !== "error" ? "Loading Scarlett’s lookbook…" : "The example is temporarily unavailable."}</p>
        {state === "error" && <button type="button" className="underline underline-offset-4" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
      </div>}
    </div>
    <figcaption className="mt-3 text-center text-xs text-muted-foreground">{FEATURED_CREDIT}</figcaption>
  </figure>;
}
