import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { PreviewChrome } from "@/components/products/PreviewChrome";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";
import { getProduct, redeemProduct, closeProductEdition } from "@/lib/products/functions";
export const Route = createFileRoute("/product/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Digital edition — Portfolia" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ProductPage,
});
function ProductPage() {
  const { id } = Route.useParams();
  const [p, setP] = useState<Awaited<ReturnType<typeof getProduct>> | undefined>(undefined),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [page, setPage] = useState(1);
  const refresh = () => getProduct({ data: { id } }).then(setP);
  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("access");
    if (token) window.history.replaceState(null, "", window.location.pathname);
    setBusy(true);
    setError("");
    void (async () => {
      if (token)
        try {
          await redeemProduct({ data: { id, token } });
        } catch (e) {
          if (active) setError((e as Error).message);
        }
      const data = await getProduct({ data: { id } });
      if (active) setP(data);
    })()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  const source = useMemo(() => (p?.fileUrl ? { url: p.fileUrl } : null), [p?.fileUrl]);
  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <a href="/digital-product-studio" className="text-xs">
            Create your own digital edition
          </a>
        }
      />
      <main className="shell py-8">
        <div className="max-w-3xl mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {p?.customer ? "Your customer edition" : "Public product preview"}
          </p>
          <h1 className="display-title text-4xl mt-3">
            {p?.title ?? (p === null ? "Product unavailable" : "Digital edition")}
          </h1>
          {p && <p className="mt-4 whitespace-pre-line text-muted-foreground">{p.description}</p>}
        </div>
        {error && (
          <p role="alert" className="rounded-xl border p-4 mb-4">
            {error}{" "}
            <button className="underline" onClick={() => setRetry((n) => n + 1)}>
              Retry
            </button>
          </p>
        )}
        {busy && <p role="status">Opening your edition…</p>}
        {p === null && (
          <p>This product is not available. Contact the seller if you have already purchased it.</p>
        )}
        {p && (
          <>
            <div className="flex flex-wrap gap-3 items-center mb-5">
              {!p.customer && p.buyUrl && (
                <Button asChild>
                  <a href={p.buyUrl} target="_blank" rel="noopener noreferrer">
                    Buy the full product ↗
                  </a>
                </Button>
              )}
              {p.allowDownload && p.fileUrl && (
                <Button asChild>
                  <a href={`${p.fileUrl}&download=1`} download>
                    Download PDF
                  </a>
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {p.customer
                  ? "Customer access is active in this browser for up to 12 hours."
                  : `${p.pages} preview pages · checkout is handled by the seller's shop.`}
              </span>
              {p.customer && (
                <button
                  className="text-xs underline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void closeProductEdition({ data: { id } })
                      .then(refresh)
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Close customer edition
                </button>
              )}
            </div>
            {source ? (
              <div className="relative rounded-2xl border overflow-hidden">
                {!p.customer && <PreviewChrome buyUrl={p.buyUrl} pages={p.pages} page={page} />}
                <PdfViewer
                  key={p.customer ? "customer" : "preview"}
                  source={source}
                  fileName={p.title}
                  viewer={{ ...DEFAULT_VIEWER, ...p.appearance, showHeader: false }}
                  allowDownload={false}
                  pageArrows
                  onReaderPage={setPage}
                />
              </div>
            ) : (
              <p className="py-12">No public preview is available.</p>
            )}
            {!p.customer && (
              <details className="max-w-xl mt-8 rounded-xl border p-5">
                <summary className="cursor-pointer font-medium">Already purchased?</summary>
                <p className="text-sm mt-3 text-muted-foreground">
                  Open the customer link in the delivery PDF from your order. You can also paste
                  that link or access code below. Your order number alone cannot unlock a product.
                </p>
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    let token = code.trim();
                    try {
                      if (token.startsWith("https://"))
                        token =
                          new URLSearchParams(new URL(token).hash.slice(1)).get("access") ?? "";
                    } catch {}
                    void redeemProduct({ data: { id, token } })
                      .then(refresh)
                      .then(() => setCode(""))
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  <input
                    aria-label="Customer link or access code"
                    type="password"
                    autoComplete="off"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border bg-background p-2 text-sm"
                  />
                  <Button disabled={busy || !code}>Open edition</Button>
                </form>
                <p className="text-xs mt-3 text-muted-foreground">
                  For purchase or access issues, contact the seller through your original order.
                </p>
              </details>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
