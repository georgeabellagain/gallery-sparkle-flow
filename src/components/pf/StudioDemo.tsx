import { useEffect, useState } from "react";
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
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    void getPublicPortfolio({ data: { by: "code", value: FEATURED_PORTFOLIO_CODE } }).then((result) => {
      if (cancelled) return;
      setData(result);
      setState((result?.portfolio.pdf && result.urls[result.portfolio.pdf.blobKey]) ? "ready" : "error");
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [attempt]);
  const p = data?.portfolio;
  const url = p?.pdf && data?.urls[p.pdf.blobKey];
  return <figure className={className ?? "mx-auto w-full max-w-5xl"}>
    <div className="relative overflow-hidden rounded-3xl border border-border shadow-lift [&_.pf-book-viewport]:h-[28rem] sm:[&_.pf-book-viewport]:h-[36rem] lg:[&_.pf-book-viewport]:h-[40rem]" style={{ background: p?.viewer?.backgroundColor ?? "#02011e" }}>
      {state === "ready" && p?.pdf && url ? <PdfViewer
        source={{ url }}
        fileName={p.pdf.name}
        viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", modes: ["book"], looks: ["clean", "studio"] }}
        backgroundUrl={p.viewer?.backgroundKey ? data?.urls[p.viewer.backgroundKey] : undefined}
        controls
      /> : <div role="status" className="flex h-[28rem] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
        <p>{state === "loading" ? "Loading Scarlett’s lookbook…" : "The example is temporarily unavailable."}</p>
        {state === "error" && <button type="button" className="underline underline-offset-4" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
      </div>}
    </div>
    <figcaption className="mt-3 text-center text-xs text-muted-foreground">{FEATURED_CREDIT}</figcaption>
  </figure>;
}
