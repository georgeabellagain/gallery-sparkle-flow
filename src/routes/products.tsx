import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Plus } from "lucide-react";
import { AppHeader, SiteFooter, CenteredPage } from "@/components/pf/Chrome";
import { UpgradeModal, type PlanChoice } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { WorkspaceTabs } from "@/components/products/WorkspaceTabs";
import { useAccount } from "@/hooks/useAccount";
import { productAuth } from "@/lib/products/client";
import { listProducts, createProduct } from "@/lib/products/functions";
import { nextProductStep, type ProductStep } from "@/lib/products/plan";
import { hasPendingProductPdf } from "@/lib/products/pending";
import { productShareUrl } from "@/lib/products/model";
import { productStatsSummary } from "@/lib/products/stats.functions";
export const Route = createFileRoute("/products")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: "My products — Portfolia" }, { name: "robots", content: "noindex" }],
  }),
  component: Products,
});
type Listing = Awaited<ReturnType<typeof listProducts>>;
const NEXT: Record<ProductStep, string> = {
  upload: "Next: upload your PDF",
  preview: "Next: choose preview pages",
  publish: "Ready to publish",
  share: "Online — get your links",
};
const PLAN_NAME = { free: "Free", personal: "Personal", business: "Business" } as const;
function Products() {
  const { user, loading } = useAccount();
  const [data, setData] = useState<Listing | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [upgrade, setUpgrade] = useState<null | { plan: PlanChoice; reason?: string }>(null),
    [copied, setCopied] = useState(""),
    [notice, setNotice] = useState(""),
    [summary, setSummary] = useState<Record<string, { views: number; buys: number }>>({});
  // Feature C: 30-day views and buy clicks for every published product, in one call. Quietly empty on failure.
  useEffect(() => {
    const ids = (data?.items ?? []).filter((i) => i.status === "published").map((i) => i.id);
    if (!ids.length) return;
    let active = true;
    void productAuth()
      .then((headers) => productStatsSummary({ data: { ids }, headers }))
      .then((s) => active && setSummary(s))
      .catch(() => {});
    return () => { active = false; };
  }, [data]);
  const checkoutDone = typeof window !== "undefined" && window.location.search.includes("checkout=success");
  useEffect(() => {
    let active = true;
    if (user)
      void productAuth()
        .then((headers) => listProducts({ headers }))
        .then((rows) => {
          if (active) setData(rows);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [user?.id, retry]);
  // After paying, the plan arrives a few seconds later: look again until it does.
  useEffect(() => {
    if (!checkoutDone || !data || data.plan !== "free" || retry > 8) return;
    const timer = window.setTimeout(() => setRetry((n) => n + 1), 3000);
    return () => window.clearTimeout(timer);
  }, [checkoutDone, data, retry]);
  // A PDF dropped on a landing page waits in this browser (see lib/products/pending.ts). Once the list is here, make the
  // product and let its editor upload the file; when the plan is full, show the upgrade prompt and keep the file.
  const pendingHandled = useRef(false);
  useEffect(() => {
    if (!data || pendingHandled.current || !new URLSearchParams(window.location.search).has("pending")) return;
    pendingHandled.current = true;
    if (!hasPendingProductPdf()) { setNotice("The PDF you chose is no longer waiting. Choose it again to start your product."); return; }
    if (data.items.length >= data.allowance.products) {
      setUpgrade({ plan: data.plan === "free" ? "personal" : "business", reason: data.plan === "business" ? undefined : "More products" });
      setNotice("Your PDF is kept on this device for 10 minutes. Upgrade or make room, then drop it on a product page again.");
      return;
    }
    setBusy(true);
    void productAuth()
      .then((headers) => createProduct({ headers }))
      .then((id) => window.location.assign(`/product-studio/${id}?pending=1`))
      .catch((e) => { setError((e as Error).message); setBusy(false); });
  }, [data]);
  if (loading) return <CenteredPage title="Your products" intro="Loading your workspace…" />;
  if (!user)
    return (
      <CenteredPage
        title="Digital Product Studio"
        intro="Sign in to create public previews and customer editions."
      >
        <Button asChild>
          <a href="/signin">Sign in</a>
        </Button>
      </CenteredPage>
    );
  const items = data?.items,
    plan = data?.plan ?? "free",
    max = data?.allowance.products ?? 1,
    full = Boolean(items && items.length >= max);
  const create = async () => {
    if (full) return setUpgrade({ plan: plan === "free" ? "personal" : "business", reason: plan === "business" ? undefined : "More products" });
    setBusy(true);
    setError("");
    try {
      const id = await createProduct({ headers: await productAuth() });
      window.location.assign(`/product-studio/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const copy = async (id: string) => {
    try {
      const item = data?.items.find((i) => i.id === id);
      await navigator.clipboard.writeText(productShareUrl({ id, slug: item?.slug }));
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? "" : c)), 2000);
    } catch {
      setError("Couldn’t copy the link. Open the product to copy it from there.");
    }
  };
  return (
    <div className="min-h-screen">
      <AppHeader email={user.email} />
      <main className="shell py-8 sm:py-10">
        <WorkspaceTabs active="products" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-xs">Digital Product Studio</p>
            <h1 className="display-title mt-1 text-4xl">Products</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              A free preview for shoppers and a private full edition for customers, from one PDF.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {items && <span className="text-xs text-muted-foreground">{items.length}/{max} · {PLAN_NAME[plan]}</span>}
            <Button size="sm" disabled={busy || !items} onClick={() => void create()}>
              <Plus /> {busy ? "Creating…" : "New product"}
            </Button>
          </div>
        </div>
        {checkoutDone && plan === "free" && data && (
          <p role="status" className="mt-6 rounded-xl bg-muted p-3 text-sm">Payment received — confirming your plan…</p>
        )}
        {data && plan === "free" && !checkoutDone && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-leaf/40 bg-leaf-soft/50 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">You’re trying the studio on Free</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Build one product and see exactly how it will look. Publishing, the preview link and customer links are part of Personal and Business.
              </p>
            </div>
            <Button size="sm" onClick={() => setUpgrade({ plan: "personal", reason: "Publishing products" })}>See plans</Button>
          </div>
        )}
        {notice && <p role="status" className="mt-6 rounded-xl bg-muted p-3 text-sm">{notice}</p>}
        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-destructive/20 p-4 text-sm text-destructive">
            {error}{" "}
            <button
              className="underline"
              onClick={() => {
                setError("");
                setRetry((n) => n + 1);
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!items && !error ? (
          <p role="status" className="py-12 text-sm text-muted-foreground">
            Loading products…
          </p>
        ) : items?.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const live = item.status === "published";
              return (
                <article key={item.id} className="flex flex-col rounded-2xl border border-border p-5 transition-colors hover:border-foreground/30">
                  {/* Feature A: page 1 of the public preview; the first letter of the title until there is one. */}
                  <a href={`/product-studio/${item.id}`} tabIndex={-1} aria-hidden className="mb-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {item.coverUrl
                      ? <img src={item.coverUrl} alt={`Cover of ${item.title}`} loading="lazy" className="h-[85%] w-auto max-w-[85%] object-contain shadow-soft" />
                      : <span className="display-title text-5xl text-muted-foreground">{item.title.trim().charAt(0).toUpperCase() || "P"}</span>}
                  </a>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className={live ? "inline-flex items-center gap-1.5 rounded-full bg-leaf-soft px-2.5 py-1 font-medium text-leaf" : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1"}>
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {live ? "Published" : "Draft"}
                    </span>
                    <span>{item.pages ? `${item.pages} pages · ` : ""}Edited {new Date(item.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                  </div>
                  <a href={`/product-studio/${item.id}`} className="mt-4 block">
                    <h2 className="truncate text-lg font-medium underline-offset-4 hover:underline">{item.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{NEXT[nextProductStep(item)]}</p>
                  </a>
                  {live && summary[item.id] && <p className="mt-1 text-xs text-muted-foreground">{summary[item.id]!.views} view{summary[item.id]!.views === 1 ? "" : "s"} · {summary[item.id]!.buys} buy click{summary[item.id]!.buys === 1 ? "" : "s"} in 30 days</p>}
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button asChild size="sm" variant={live ? "line" : "default"}>
                      <a href={`/product-studio/${item.id}`}>{live ? "Edit" : "Continue"}</a>
                    </Button>
                    {live && (
                      <>
                        <Button size="sm" variant="line" onClick={() => void copy(item.id)}>
                          {copied === item.id ? <Check /> : <Copy />} {copied === item.id ? "Copied" : "Preview link"}
                        </Button>
                        <Button asChild size="sm" variant="quiet">
                          <a href={`/product/${item.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Open the public preview of ${item.title}`}>
                            <ExternalLink /> Open
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : items ? (
          <section className="mt-8 rounded-3xl border border-border bg-muted/40 p-8 sm:p-10">
            <h2 className="text-xl font-medium">Three steps from PDF to product.</h2>
            <ol className="mt-5 grid gap-5 text-sm sm:grid-cols-3">
              <li>
                <b>1 · Upload</b>
                <p className="mt-2 text-muted-foreground">Your complete PDF stays private. A first preview is made for you.</p>
              </li>
              <li>
                <b>2 · Publish</b>
                <p className="mt-2 text-muted-foreground">Choose which pages shoppers see, style the book, then put it online.</p>
              </li>
              <li>
                <b>3 · Share two links</b>
                <p className="mt-2 text-muted-foreground">A preview link for your listing, and a private link for customers.</p>
              </li>
            </ol>
            <Button className="mt-7" disabled={busy} onClick={() => void create()}>
              <Plus /> {busy ? "Creating…" : "Create your first product"}
            </Button>
          </section>
        ) : null}
        <p className="mt-8 text-xs text-muted-foreground">
          Free: try one product, PDFs up to 30 MB. Personal: publish up to 10 products, PDFs up to 100 MB. Business: up to 50 products, PDFs up to 250 MB.{" "}
          <a href="/pricing" className="underline underline-offset-4">Compare plans</a>
        </p>
      </main>
      <SiteFooter />
      <UpgradeModal open={upgrade !== null} plan={upgrade?.plan} reason={upgrade?.reason} products={{ plan, returnTo: "/products" }} onClose={() => setUpgrade(null)} />
    </div>
  );
}
