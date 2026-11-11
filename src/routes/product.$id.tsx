import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter, Wordmark } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { PreviewChrome } from "@/components/products/PreviewChrome";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";
import { getProduct, redeemProduct, closeProductEdition } from "@/lib/products/functions";
import { buyButtonLabel, productId, productListing } from "@/lib/products/model";
import { STAMP_SERVER_LIMIT_BYTES } from "@/lib/products/plan";
import { productRef, recordOnce, sendProductEvent } from "@/lib/products/events";
import { formatBytes } from "@/lib/portfolia/assets";
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
  // The address may be a readable one (Feature B); customer links always use the id.
  const { id: param } = Route.useParams();
  const isId = productId.safeParse(param).success;
  const [p, setP] = useState<Awaited<ReturnType<typeof getProduct>> | undefined>(undefined),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [page, setPage] = useState(1);
  const id = p?.id ?? param;
  const refresh = () => getProduct({ data: productRef(param) }).then(setP);
  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("access");
    if (token) window.history.replaceState(null, "", window.location.pathname);
    setBusy(true);
    setError("");
    void (async () => {
      if (token && isId)
        try {
          await redeemProduct({ data: { id: param, token } });
        } catch (e) {
          if (active) setError((e as Error).message);
        }
      const data = await getProduct({ data: productRef(param) });
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
  }, [param, retry]);
  // Feature C: one preview view per browser session. Customers are counted when they redeem, not here.
  useEffect(() => { if (p && !p.customer) recordOnce(p.id); }, [p?.id, p?.customer]);
  const [saving, setSaving] = useState("");
  // Feature D: over the server limit, a stamped copy is made in this browser from the customer file.
  const browserStamp = Boolean(p?.stamp && p.fullBytes && p.fullBytes > STAMP_SERVER_LIMIT_BYTES);
  const downloadStamped = async () => {
    if (!p?.fileUrl || !p.stamp) return;
    setSaving("Preparing your copy");
    setError("");
    try {
      const res = await fetch(p.fileUrl);
      if (!res.ok) throw new Error("download");
      const { stampPdf } = await import("@/lib/products/stamp");
      const out = await stampPdf(new Uint8Array(await res.arrayBuffer()), p.stamp);
      const { downloadBlob } = await import("@/lib/products/preview");
      downloadBlob(new Blob([out as BlobPart], { type: "application/pdf" }), "digital-product.pdf");
    } catch {
      setError("This file can’t be stamped. Contact the seller.");
    } finally {
      setSaving("");
    }
  };
  const source = useMemo(() => (p?.fileUrl ? { url: p.fileUrl } : null), [p?.fileUrl]);
  const closeEdition = () => {
    setBusy(true);
    void closeProductEdition({ data: { id } })
      .then(refresh)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  // Buyers are the seller's customers: the page carries the seller's product, not Portfolia's marketing (plan 2, S8).
  const listing = productListing(p?.appearance), buyLabel = buyButtonLabel(listing);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="rule-b">
        <div className="shell flex h-14 items-center justify-between gap-4">
          <Wordmark />
          <a href="/digital-product-studio" className="text-xs text-muted-foreground underline-offset-4 hover:underline">Made with Portfolia</a>
        </div>
      </header>
      <main className="shell grid flex-1 gap-8 py-8 lg:grid-cols-[minmax(16rem,1fr)_3fr] lg:gap-12 lg:py-12">
        <div className="lg:sticky lg:top-8 lg:self-start">
          {p?.customer
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-soft px-3 py-1 text-xs font-medium text-leaf"><span aria-hidden className="size-1.5 rounded-full bg-current" />Your copy</span>
            : p && <p className="label-xs">Free preview{p.pages ? ` · ${p.pages} pages` : ""}</p>}
          <h1 className="display-title mt-3 text-4xl sm:text-5xl">
            {p?.title ?? (p === null ? "Product unavailable" : "Digital edition")}
          </h1>
          {p && (listing.seller || (!p.customer && listing.price)) && (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              {listing.seller && <span className="text-muted-foreground">by {listing.seller}</span>}
              {!p.customer && listing.price && <span className="font-medium">{listing.price}</span>}
            </p>
          )}
          {p && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{p.description}</p>}
          {p?.customer && (
            <div className="mt-6 space-y-3">
              {p.allowDownload && p.fileUrl && (browserStamp
                ? <Button disabled={Boolean(saving)} onClick={() => void downloadStamped()}>{saving ? `${saving}…` : "Download your copy"}</Button>
                : <Button asChild><a href={`${p.fileUrl}&download=1`} download>{p.stamp ? "Download your copy" : "Download PDF"}</a></Button>)}
              <p className="text-xs text-muted-foreground">Customer access is active in this browser for up to 12 hours.</p>
              <button type="button" className="text-xs underline" disabled={busy} onClick={closeEdition}>Close customer edition</button>
            </div>
          )}
          {p?.customer && p.extras.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-base font-medium">Included with your purchase</h2>
              <ul className="mt-3 space-y-2">
                {p.extras.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0"><span className="block truncate">{x.name}</span><span className="text-xs text-muted-foreground">{x.kind.toUpperCase()} · {formatBytes(x.bytes)}</span></span>
                    <Button asChild size="sm" variant="line"><a href={`/api/public/product-file/${p.id}?extra=${x.id}`} download>Download</a></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p && !p.customer && p.extrasCount > 0 && <p className="mt-4 text-sm">Also includes {p.extrasCount} extra file{p.extrasCount === 1 ? "" : "s"}.</p>}
          {p && !p.customer && <p className="mt-6 hidden text-xs text-muted-foreground lg:block">Checkout is handled by the seller’s shop.</p>}
        </div>
        <div className="min-w-0">
          {error && (
            <p role="alert" className="mb-4 rounded-2xl border border-border p-4 text-sm">
              {error}{" "}
              <button className="underline" onClick={() => setRetry((n) => n + 1)}>Retry</button>
            </p>
          )}
          {busy && <p role="status" className="mb-4 text-sm">Opening your edition…</p>}
          {p === null && <p>This product is not available. Contact the seller if you have already purchased it.</p>}
          {p && (source ? (
            <div className="relative overflow-hidden rounded-3xl bg-[#e9e8df] shadow-soft [&_.pf-book-viewport]:h-[min(78svh,52rem)]">
              {!p.customer && <PreviewChrome buyLabel={buyLabel} buyUrl={p.buyUrl} pages={p.pages} page={page} className="hidden sm:flex" onBuy={() => sendProductEvent(p.id, "buy_click")} />}
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
          ))}
          {p && !p.customer && (
            <details className="mt-8 max-w-xl rounded-2xl border border-border p-5">
              <summary className="cursor-pointer font-medium">Already purchased?</summary>
              <p className="mt-3 text-sm text-muted-foreground">
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
                      token = new URLSearchParams(new URL(token).hash.slice(1)).get("access") ?? "";
                  } catch {
                    /* not a link: use it as a code */
                  }
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
              <p className="mt-3 text-xs text-muted-foreground">For purchase or access issues, contact the seller through your original order.</p>
            </details>
          )}
        </div>
      </main>
      {/* Phones: the buy button stays in reach while the preview is read. */}
      {p && !p.customer && p.buyUrl && (
        <div className="sticky bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button asChild className="w-full">
            <a href={p.buyUrl} target="_blank" rel="noopener noreferrer" onClick={() => sendProductEvent(p.id, "buy_click")}>{buyLabel} ↗</a>
          </Button>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
