import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter, CenteredPage } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { WorkspaceTabs } from "@/components/products/WorkspaceTabs";
import { useAccount } from "@/hooks/useAccount";
import { productAuth } from "@/lib/products/client";
import { listProducts, createProduct } from "@/lib/products/functions";
export const Route = createFileRoute("/products")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: "My products — Portfolia" }, { name: "robots", content: "noindex" }],
  }),
  component: Products,
});
function Products() {
  const { user, loading } = useAccount();
  const [items, setItems] = useState<Awaited<ReturnType<typeof listProducts>> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (user)
      void productAuth()
        .then((headers) => listProducts({ headers }))
        .then((rows) => {
          if (active) setItems(rows);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [user?.id, retry]);
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
  return (
    <div className="min-h-screen">
      <SiteHeader right={<a href="/account">Account</a>} />
      <main className="shell py-10">
        <WorkspaceTabs active="products" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Portfolia / Digital Product Studio
            </p>
            <h1 className="display-title text-4xl mt-2">Your products.</h1>
            <p className="mt-3 text-muted-foreground max-w-xl">
              A public preview for your shop. A complete edition for your customers. All in one
              place.
            </p>
          </div>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const id = await createProduct({ headers: await productAuth() });
                window.location.assign(`/product-studio/${id}`);
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating…" : "Create product"}
          </Button>
        </div>
        {error && (
          <div role="alert" className="my-6 rounded-xl border p-4">
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
          <p role="status" className="py-12">
            Loading products…
          </p>
        ) : items?.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-9">
            {items.map((item) => (
              <a
                key={item.id}
                href={`/product-studio/${item.id}`}
                className="rounded-2xl border border-border p-6 hover:bg-muted/50"
              >
                <span className="text-xs text-muted-foreground">
                  {item.status === "published" ? "Published" : "Draft"}
                </span>
                <h2 className="text-xl font-medium mt-4">{item.title}</h2>
                <p className="text-sm text-muted-foreground mt-3">
                  Edit preview, appearance and customer access →
                </p>
              </a>
            ))}
          </div>
        ) : (
          <section className="rounded-3xl bg-muted/40 border p-10 mt-9">
            <h2 className="text-xl font-medium">Your first digital edition starts here.</h2>
            <ol className="mt-5 grid gap-5 sm:grid-cols-3 text-sm">
              <li>
                <b>01 / Upload</b>
                <p className="mt-2 text-muted-foreground">Keep the complete PDF private.</p>
              </li>
              <li>
                <b>02 / Preview</b>
                <p className="mt-2 text-muted-foreground">
                  Choose exactly which pages shoppers see.
                </p>
              </li>
              <li>
                <b>03 / Deliver</b>
                <p className="mt-2 text-muted-foreground">
                  Give customers an access link through your existing shop.
                </p>
              </li>
            </ol>
          </section>
        )}
        <p className="text-xs text-muted-foreground mt-8">
          Free: 1 product, PDFs up to 30 MB. Paid plans: 10 products, PDFs up to 100 MB. HD
          marketing exports require Personal or Business.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
