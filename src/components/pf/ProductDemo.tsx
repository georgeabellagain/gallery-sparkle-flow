import { useEffect, useMemo, useRef, useState } from "react";
import { PdfViewer } from "./PdfViewer";
import { BookLoader } from "./book-loader";
import { Button } from "@/components/ui/button";
import { registerPublicUrls } from "@/lib/portfolia/assets";
import { getPublicPortfolio, type PublicPortfolio } from "@/lib/portfolia/public.functions";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";

// Owner-chosen example: the live PINK book, shown as a product preview in Studio only.
export const PRODUCT_DEMO_CODE = "pink28";
export const PRODUCT_DEMO_BUY_URL = "https://www.etsy.com/uk/listing/4479273509/pink-fun-childrens-story-book-o";

export function ProductDemo({ className }: { className?: string }) {
  const [data, setData] = useState<PublicPortfolio>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [shown, setShown] = useState(false);
  const started = useRef<number | undefined>(undefined);
  useEffect(() => {
    let off = false;
    getPublicPortfolio({ data: { by: "code", value: PRODUCT_DEMO_CODE } }).then((r) => {
      if (off) return;
      console.log("pdemo", JSON.stringify({ has: !!r, pdf: r?.portfolio.pdf?.blobKey, url: r && r.portfolio.pdf ? !!r.urls[r.portfolio.pdf.blobKey] : null }));
      if (r) registerPublicUrls(r.urls);
      setData(r);
      setState(r?.portfolio.pdf && r.urls[r.portfolio.pdf.blobKey] ? "ready" : "error");
    }, () => !off && setState("error"));
    return () => { off = true; };
  }, []);
  const p = data?.portfolio, url = p?.pdf && data?.urls[p.pdf.blobKey];
  const source = useMemo(() => (url ? { url } : null), [url]);
  return (
    <figure className={className}>
      <div className="pf-workspace-demo relative h-full overflow-hidden">
        {state === "ready" && p?.pdf && source && (
          <div className="absolute inset-0" style={{ opacity: shown ? 1 : 0 }}>
            <PdfViewer
              source={source}
              fileName={p.pdf.name}
              viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", look: "studio", modes: ["book"], looks: ["studio"], idleOrbit: "start" }}
              backgroundUrl={p.viewer?.backgroundKey ? data?.urls[p.viewer.backgroundKey] : undefined}
              controls
              homepageExample
              loadingIndicator={false}
              allowDownload={false}
              initialLook="studio"
              fullSpread
              presentationActive
              showcaseOrbit={shown}
              showcaseOrbitStart={started.current}
              onDemoReady={() => { started.current ??= performance.now(); setShown(true); }}
              onBookReadyChange={(r: boolean) => { if (r) { started.current ??= performance.now(); setShown(true); } }}
              onLoadError={(e?: unknown) => { console.log("pdemo-err", String(e)); setState("error"); }}
            />
          </div>
        )}
        {shown && (
          <>
            <span className="pointer-events-none absolute right-4 top-5 z-30 rounded-full bg-background/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] shadow-soft">Preview</span>
            <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-4">
              <Button asChild className="shadow-lift">
                <a href={PRODUCT_DEMO_BUY_URL} target="_blank" rel="noopener noreferrer">Purchase to see the full version ↗</a>
              </Button>
            </div>
          </>
        )}
        {(!shown || state === "error") && (
          <div role="status" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background text-sm">
            {state === "error" ? <p>The example is temporarily unavailable.</p> : <BookLoader tone="light" label="" />}
          </div>
        )}
      </div>
    </figure>
  );
}
