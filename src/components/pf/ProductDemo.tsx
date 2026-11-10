import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfViewer } from "./PdfViewer";
import { BookLoader } from "./book-loader";
import { PreviewChrome } from "@/components/products/PreviewChrome";
import { registerPublicUrls } from "@/lib/portfolia/assets";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";
import { getProduct } from "@/lib/products/functions";
import { DEFAULT_VIEWER, type ViewerSettings } from "@/lib/portfolia/store";

// Owner-chosen example: the published Pink product's shop preview (cover + chosen
// spreads, watermarked), shown in Studio only. Falls back to the PINK portfolio.
export const PRODUCT_DEMO_ID = "c959096a-aa5d-41c7-8f7c-8dfc5e93f666";
export const PRODUCT_DEMO_CODE = "pink28";
export const PRODUCT_DEMO_BUY_URL = "https://www.etsy.com/uk/listing/4479273509/pink-fun-childrens-story-book-o";

type Demo = { url: string; name: string; viewer: Partial<ViewerSettings>; backgroundUrl?: string; pages: number; buyUrl: string };

async function loadDemo(): Promise<Demo | null> {
  const product = await getProduct({ data: { id: PRODUCT_DEMO_ID } }).catch(() => null);
  if (product?.fileUrl && !product.customer)
    return { url: product.fileUrl, name: product.title, viewer: product.appearance, pages: product.pages, buyUrl: product.buyUrl || PRODUCT_DEMO_BUY_URL };
  const r = await getPublicPortfolio({ data: { by: "code", value: PRODUCT_DEMO_CODE } });
  const p = r?.portfolio, url = p?.pdf && r?.urls[p.pdf.blobKey];
  if (!r || !p?.pdf || !url) return null;
  registerPublicUrls(r.urls);
  return { url, name: p.pdf.name, viewer: p.viewer ?? {}, backgroundUrl: p.viewer?.backgroundKey ? r.urls[p.viewer.backgroundKey] : undefined, pages: 0, buyUrl: PRODUCT_DEMO_BUY_URL };
}

export function ProductDemo({ className }: { className?: string }) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [shown, setShown] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const started = useRef<number | undefined>(undefined);
  useEffect(() => {
    let off = false;
    loadDemo().then((d) => {
      if (off) return;
      setDemo(d);
      setPages(d?.pages ?? 0);
      setState(d ? "ready" : "error");
    }, () => { if (!off) setState("error"); });
    return () => { off = true; };
  }, []);
  const source = useMemo(() => (demo ? { url: demo.url } : null), [demo?.url]);
  const reveal = useCallback(() => { started.current ??= performance.now(); setShown(true); }, []);
  return (
    <figure className={className}>
      <div className="pf-workspace-demo relative h-full overflow-hidden">
        {state === "ready" && demo && source && (
          <div className="absolute inset-0" style={{ opacity: shown ? 1 : 0 }}>
            <PdfViewer
              source={source}
              fileName={demo.name}
              viewer={{ ...DEFAULT_VIEWER, ...demo.viewer, mode: "book", look: "studio", modes: ["book"], looks: ["studio"], idleOrbit: "start" }}
              backgroundUrl={demo.backgroundUrl}
              controls
              homepageExample
              pageArrows
              loadingIndicator={false}
              allowDownload={false}
              initialLook="studio"
              fullSpread
              presentationActive
              showcaseOrbit={shown}
              showcaseOrbitStart={started.current}
              onReaderPage={setPage}
              onDemoReady={reveal}
              onBookReadyChange={(r: boolean) => { if (r) reveal(); }}
              onLoadError={() => setState("error")}
            />
          </div>
        )}
        {shown && demo && <PreviewChrome buyUrl={demo.buyUrl} pages={pages} page={page} className="bottom-20" />}
        {(!shown || state === "error") && (
          <div role="status" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background text-sm">
            {state === "error" ? <p>The example is temporarily unavailable.</p> : <BookLoader tone="light" label="" />}
          </div>
        )}
      </div>
    </figure>
  );
}
