import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { PreviewChrome } from "@/components/products/PreviewChrome";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";
import { getProduct } from "@/lib/products/functions";
import { buyButtonLabel, productListing } from "@/lib/products/model";
import { productRef, recordOnce, sendProductEvent } from "@/lib/products/events";

/**
 * Feature B3: the shop preview for a seller's own website. Preview pages only: the server ignores any customer
 * session here (previewOnly). Framed like /embed/<code> (src/server.ts allows every /embed/ path).
 */
export const Route = createFileRoute("/embed/product/$id")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Product preview — Portfolia" }, { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }] }),
  component: EmbeddedProduct,
});

function EmbeddedProduct() {
  const { id } = Route.useParams();
  const [p, setP] = useState<Awaited<ReturnType<typeof getProduct>> | undefined>(undefined);
  const [page, setPage] = useState(1);
  useEffect(() => {
    let live = true;
    void getProduct({ data: { ...productRef(id), previewOnly: true } }).then((d) => live && setP(d)).catch(() => live && setP(null));
    return () => { live = false; };
  }, [id]);
  useEffect(() => { if (p && !p.customer) recordOnce(p.id); }, [p]);
  const source = useMemo(() => (p?.fileUrl ? { url: p.fileUrl } : null), [p?.fileUrl]);
  if (p === undefined) return <div className="h-dvh bg-[#e9e8df]" aria-busy="true" />;
  if (!p || !source) return <div className="flex h-dvh items-center justify-center bg-[#e9e8df] p-6 text-sm">This preview is not available.</div>;
  return <div className="relative h-dvh overflow-hidden bg-[#e9e8df] [&_.pf-book-viewport]:h-dvh">
    <PreviewChrome buyLabel={buyButtonLabel(productListing(p.appearance))} buyUrl={p.buyUrl} pages={p.pages} page={page} onBuy={() => sendProductEvent(p.id, "buy_click")} />
    <PdfViewer source={source} fileName={p.title} viewer={{ ...DEFAULT_VIEWER, ...p.appearance, showHeader: false }} allowDownload={false} pageArrows onReaderPage={setPage} />
  </div>;
}
