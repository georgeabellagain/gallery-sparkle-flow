import { BACKGROUND_PRESETS } from "@/lib/portfolia/background-presets";
import { personalBackground } from "@/lib/portfolia/premium-appearance";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { PageTurnSettings } from "@/components/pf/PageTurnSettings";
import { PaperSettings, StudioLightingSettings } from "@/components/pf/StudioAppearanceSettings";
import { DEFAULT_VIEWER, type Portfolio, type ViewerSettings } from "@/lib/portfolia/store";
import { putLocalBlob } from "@/lib/portfolia/assets";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { productAuth, readProductPdf, uploadProductPdf } from "@/lib/products/client";
import { previewPages, type Product } from "@/lib/products/model";
import { buildProductPreview, deliverySheet, downloadBlob } from "@/lib/products/preview";
import {
  ownerProduct,
  saveProduct,
  createProductLink,
  revokeProductLink,
  deleteProduct,
} from "@/lib/products/functions";
const VideoExportPanel = lazy(() =>
  import("@/components/pf/VideoExportPanel").then((m) => ({ default: m.VideoExportPanel })),
);
const PhotoShoot = lazy(() =>
  import("@/components/pf/PhotoShoot").then((m) => ({ default: m.PhotoShoot })),
);
const field = "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
export function ProductEditor({ id }: { id: string }) {
  const [p, setP] = useState<Product | null>(null),
    [baseline, setBaseline] = useState(""),
    [personal, setPersonal] = useState(false),
    [limit, setLimit] = useState(30),
    [full, setFull] = useState<Blob | null>(null),
    [preview, setPreview] = useState<Blob | null>(null);
  const [tab, setTab] = useState("Details"),
    [pages, setPages] = useState("1"),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [edition, setEdition] = useState<"full" | "preview">("full");
  const [links, setLinks] = useState<Awaited<ReturnType<typeof ownerProduct>>["links"]>([]),
    [label, setLabel] = useState("Shop customers"),
    [expiry, setExpiry] = useState(""),
    [newLink, setNewLink] = useState(""),
    [marketing, setMarketing] = useState<{ kind: "video" | "photo"; portfolio: Portfolio } | null>(
      null,
    );
  const dirty = Boolean(p && JSON.stringify(p) !== baseline);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please retry.");
    } finally {
      setBusy("");
    }
  };
  const load = async () => {
    const data = await ownerProduct({ data: { id }, headers: await productAuth() });
    setP(data.product);
    setBaseline(JSON.stringify(data.product));
    setPersonal(data.personal);
    setLimit(data.limitMb);
    setLinks(data.links);
    setPages(data.product.preview_pages.join(", ") || "1");
    setFull(data.product.full_file ? await readProductPdf(data.product.full_file) : null);
    setPreview(data.product.preview_file ? await readProductPdf(data.product.preview_file) : null);
  };
  useEffect(() => {
    void run("Loading product", load);
  }, [id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  const patch = (values: Partial<Product>) => setP((old) => (old ? { ...old, ...values } : old));
  const viewer = { ...DEFAULT_VIEWER, ...p?.appearance, showHeader: false };
  const setViewer = (values: Partial<ViewerSettings>) => {
    patch({ appearance: { ...viewer, ...values } });
    return true;
  };
  const source = useMemo(() => {
    const blob = edition === "full" ? full : preview;
    return blob ? { blob } : null;
  }, [full, preview, edition]);
  const save = async (status = p?.status) => {
    if (!p) return;
    const result = await saveProduct({
      data: { ...p, status: status ?? "draft", appearance: p.appearance as any },
      headers: await productAuth(),
    });
    const saved = { ...p, status: status ?? "draft", revision: result.revision };
    setP(saved);
    setBaseline(JSON.stringify(saved));
    setMessage(
      saved.status === "published"
        ? "Saved. Your published product is up to date."
        : "Draft saved.",
    );
  };
  const exportMarketing = async (kind: "video" | "photo") => {
    if (kind === "video" && !personal) throw new Error("HD listing videos require Personal or Business. Upgrade from Plans and pricing.");
    if (!p || !preview || !p.preview_file)
      throw new Error("Generate the public preview first. Marketing exports use only those pages.");
    const key = `product-preview-${id}-${crypto.randomUUID()}`;
    await putLocalBlob(key, preview);
    setMarketing({
      kind,
      portfolio: {
        code: id,
        name: p.title,
        status: "draft",
        createdAt: Date.now(),
        plan: personal ? "personal" : "free",
        allowDownload: false,
        profile: { name: p.title, title: "", intro: "", email: "", links: [] },
        viewer,
        pdf: {
          blobKey: key,
          name: `${p.title} preview.pdf`,
          bytes: preview.size,
          pages: p.preview_file.pages,
          uploadedAt: Date.now(),
        },
      },
    });
  };
  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <a
            href="/products"
            onClick={(e) => {
              if ((dirty || busy) && !window.confirm("Leave without saving these changes?"))
                e.preventDefault();
            }}
          >
            ← My products
          </a>
        }
      />
      <main className="shell py-7">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Digital Product Studio
            </p>
            <h1 className="display-title text-3xl mt-2">{p?.title ?? "Your product"}</h1>
            <p className="text-xs mt-2 text-muted-foreground">
              {dirty
                ? "Unsaved changes"
                : p?.status === "published"
                  ? "Published"
                  : "Private draft"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!!busy || !dirty}
              onClick={() => {
                if (window.confirm("Discard your unsaved changes?")) void run("Restoring", load);
              }}
            >
              Discard
            </Button>
            <Button disabled={!!busy || !p} onClick={() => void run("Saving", () => save())}>
              Save
            </Button>
            {p?.status !== "published" && (
              <Button
                disabled={!!busy || !p?.preview_file || !p.full_file}
                onClick={() => void run("Publishing", () => save("published"))}
              >
                Publish product
              </Button>
            )}
          </div>
        </div>
        {busy && (
          <p role="status" aria-live="polite" className="py-3 text-sm">
            {busy}…
          </p>
        )}
        {error && (
          <p role="alert" className="my-3 rounded-xl bg-destructive/10 p-4 text-sm">
            {error}{" "}
            {!p && (
              <button className="underline" onClick={() => void run("Loading", load)}>
                Retry
              </button>
            )}
          </p>
        )}
        {message && (
          <p role="status" className="my-3 text-sm">
            {message}
          </p>
        )}
        {p && (
          <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-8 mt-6">
            <section>
              <div
                className="flex flex-wrap gap-1 mb-5"
                role="tablist"
                aria-label="Product settings"
              >
                {["Details", "Preview", "Appearance", "Customers", "Marketing"].map((t) => (
                  <button
                    disabled={!!busy}
                    role="tab"
                    aria-selected={tab === t}
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-full px-3 py-2 text-xs ${tab === t ? "bg-foreground text-background" : "bg-muted"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <fieldset disabled={!!busy} className="space-y-5 disabled:opacity-70">
                {tab === "Details" && (
                  <>
                    <label className="block text-sm">
                      Product title
                      <input
                        className={field}
                        maxLength={120}
                        value={p.title}
                        onChange={(e) => patch({ title: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      Description
                      <textarea
                        className={field}
                        rows={4}
                        maxLength={3000}
                        value={p.description}
                        onChange={(e) => patch({ description: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      Shop or listing URL
                      <input
                        type="url"
                        placeholder="https://www.etsy.com/listing/…"
                        className={field}
                        value={p.buy_url}
                        onChange={(e) => patch({ buy_url: e.target.value })}
                      />
                    </label>
                    <div className="rounded-xl border p-4">
                      <p className="text-sm font-medium">Complete customer PDF</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {p.full_file
                          ? `${p.full_file.name} · ${p.full_file.pages} pages`
                          : "Private until a customer unlocks their edition."}{" "}
                        · Up to {limit} MB
                      </p>
                      <input
                        aria-label="Upload complete customer PDF"
                        className="mt-4 w-full text-xs"
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          void run("Checking and uploading PDF", async () => {
                            if (f.size > limit * 1048576)
                              throw new Error(`Your limit is ${limit} MB.`);
                            const js = await loadPdfjs();
                            const doc = await js.getDocument({
                              data: new Uint8Array(await f.arrayBuffer()),
                            }).promise;
                            let n = 0;
                            try {
                              n = doc.numPages;
                              if (n > 2000)
                                throw new Error("Please use a PDF with at most 2,000 pages.");
                            } finally {
                              await doc.destroy();
                            }
                            const saved = await uploadProductPdf(id, f, f.name, n);
                            setFull(f);
                            setPreview(null);
                            setEdition("full");
                            patch({
                              title:
                                p.title === "Untitled product"
                                  ? f.name.replace(/\.pdf$/i, "").slice(0, 120)
                                  : p.title,
                              full_file: saved,
                              preview_file: null,
                              preview_pages: [],
                              status: "draft",
                            });
                            setMessage(
                              "PDF uploaded. Generate a new preview and save before publishing.",
                            );
                          });
                        }}
                      />
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={p.allow_download}
                        onChange={(e) => patch({ allow_download: e.target.checked })}
                      />
                      Offer customers a PDF download
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Turning off the download button is not copy protection. Readers can still
                      capture content they can view.
                    </p>
                  </>
                )}
                {tab === "Preview" && (
                  <>
                    <h2 className="font-medium">Choose what shoppers see.</h2>
                    <p className="text-sm text-muted-foreground">
                      Select specific pages in reading order. The public preview is a separate,
                      flattened PDF: unselected pages and embedded files are excluded.
                    </p>
                    <label className="block text-sm">
                      Page numbers or ranges
                      <input
                        className={field}
                        placeholder="1, 3-5, 9"
                        value={pages}
                        onChange={(e) => setPages(e.target.value)}
                      />
                    </label>
                    <Button
                      disabled={!full}
                      onClick={() =>
                        void run("Generating preview", async () => {
                          if (!full || !p.full_file) return;
                          const selected = previewPages(pages, p.full_file.pages);
                          const blob = await buildProductPreview(full, selected, (n) =>
                            setBusy(`Generating preview ${Math.round(n * 100)}%`),
                          );
                          if (blob.size > limit * 1048576)
                            throw new Error("Preview is too large. Select fewer pages.");
                          const file = await uploadProductPdf(
                            id,
                            blob,
                            "preview.pdf",
                            selected.length,
                          );
                          setPreview(blob);
                          patch({ preview_file: file, preview_pages: selected });
                          setEdition("preview");
                          setMessage("Preview generated. Check it on the right, then save.");
                        })
                      }
                    >
                      Generate preview
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Current preview: {p.preview_pages.join(", ") || "not generated"}. Up to 40
                      pages. Regenerate after changing the selection.
                    </p>
                    {p.status === "published" && (
                      <a
                        className="block text-sm underline"
                        href={`/product/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open published product
                      </a>
                    )}
                  </>
                )}
                {tab === "Appearance" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {(["clean", "studio"] as const).map((look) => (
                        <button
                          aria-pressed={viewer.look === look}
                          key={look}
                          className={`rounded-xl border p-3 text-sm ${viewer.look === look ? "border-foreground" : "border-border"}`}
                          onClick={() => setViewer({ look })}
                        >
                          {look === "clean" ? "Simple" : "Studio"}
                        </button>
                      ))}
                    </div>
                    <PageTurnSettings showTabs={false} showTest={false}
                      viewer={viewer}
                      setViewer={setViewer}
                      pages={edition === "full" ? p.full_file?.pages : p.preview_file?.pages}
                    />
                    <label className="block text-sm">
                      Page layout
                      <select
                        className={field}
                        value={viewer.spreads}
                        onChange={(e) =>
                          setViewer({ spreads: e.target.value as "single" | "ready" })
                        }
                      >
                        <option value="single">Individual PDF pages</option>
                        <option value="ready">PDF pages are complete spreads</option>
                      </select>
                    </label>
                    <label className="flex justify-between text-sm items-center">
                      Background colour
                      <input
                        type="color"
                        value={viewer.backgroundColor ?? "#e9e5dc"}
                        onChange={(e) => setViewer({ backgroundColor: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      Background texture
                      <select
                        className={field}
                        value={viewer.backgroundPreset ?? ""}
                        onChange={(e) =>
                          setViewer({ backgroundPreset: e.target.value || undefined })
                        }
                      >
                        <option value="">Solid colour</option>
                        {[false, true].map((paid) => (
                          <optgroup key={String(paid)} label={paid ? "Personal" : "Free"}>
                            {BACKGROUND_PRESETS.filter(
                              (b) => personalBackground(b.id) === paid,
                            ).map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    {viewer.look === "studio" && (
                      <>
                        <StudioLightingSettings viewer={viewer} setViewer={setViewer} />
                        <PaperSettings viewer={viewer} setViewer={setViewer} />
                      </>
                    )}
                  </>
                )}
                {tab === "Customers" && (
                  <>
                    <h2 className="font-medium">Customer access</h2>
                    <p className="text-sm text-muted-foreground">
                      Create a shared link for your shop, or a separate labelled link for an
                      individual order. Anyone with a link can use it. Links are not automatic proof
                      of purchase.
                    </p>
                    <label className="block text-sm">
                      Link label
                      <input
                        className={field}
                        maxLength={100}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm">
                      Optional expiry
                      <input
                        type="datetime-local"
                        className={field}
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                      />
                    </label>
                    <Button
                      disabled={p.status !== "published" || dirty}
                      onClick={() =>
                        void run("Creating access", async () => {
                          const result = await createProductLink({
                            data: {
                              id,
                              label,
                              expiresAt: expiry ? new Date(expiry).toISOString() : null,
                            },
                            headers: await productAuth(),
                          });
                          setNewLink(result.url);
                          setLinks([
                            {
                              id: result.id,
                              label,
                              revoked: false,
                              expires_at: expiry ? new Date(expiry).toISOString() : null,
                            },
                            ...links,
                          ]);
                        })
                      }
                    >
                      Create customer link
                    </Button>
                    {(p.status !== "published" || dirty) && (
                      <p className="text-xs text-muted-foreground">
                        Save and publish before creating access links.
                      </p>
                    )}
                    {newLink && (
                      <div className="rounded-xl border p-4 space-y-3">
                        <p className="text-sm font-medium">Save this link now</p>
                        <p className="text-xs text-muted-foreground">
                          For security, it will not be shown again. It is included in the delivery
                          PDF.
                        </p>
                        <input
                          aria-label="New customer link"
                          readOnly
                          value={newLink}
                          className={field}
                        />
                        <Button
                          variant="outline"
                          onClick={() =>
                            void run("Copying", async () => {
                              await navigator.clipboard.writeText(newLink);
                              setMessage("Customer link copied.");
                            })
                          }
                        >
                          Copy link
                        </Button>
                        <Button
                          onClick={() =>
                            void run("Creating delivery PDF", async () =>
                              downloadBlob(
                                await deliverySheet(p.title, newLink),
                                "customer-access.pdf",
                              ),
                            )
                          }
                        >
                          Download delivery PDF
                        </Button>
                      </div>
                    )}
                    <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
                      <li>
                        Download the delivery PDF and attach it to your shop's digital listing.
                      </li>
                      <li>
                        Explain that the purchase includes a browser-based edition and whether a PDF
                        download is offered.
                      </li>
                      <li>
                        Place the public preview link in your listing where supported. Never place
                        the customer link publicly.
                      </li>
                    </ol>
                    <p className="text-xs text-muted-foreground">
                      Etsy integration uses its digital file delivery. No Etsy connection, order
                      verification or buyer emails are accessed. Revoking a shared shop link affects
                      every customer who received it; update the delivery PDF and help existing
                      buyers.
                    </p>
                    <div className="space-y-2">
                      {links.map((link) => (
                        <div key={link.id} className="border rounded-xl p-3 text-sm">
                          <p>{link.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {link.revoked
                              ? "Revoked"
                              : link.expires_at
                                ? `Expires ${new Date(link.expires_at).toLocaleString()}`
                                : "No expiry"}
                          </p>
                          {!link.revoked && (
                            <button
                              className="mt-2 text-xs underline"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Revoke “${link.label}”? Everyone using this link will lose future access.`,
                                  )
                                )
                                  void run("Revoking", async () => {
                                    await revokeProductLink({
                                      data: { id, linkId: link.id },
                                      headers: await productAuth(),
                                    });
                                    setLinks((items) =>
                                      items.map((l) =>
                                        l.id === link.id ? { ...l, revoked: true } : l,
                                      ),
                                    );
                                    setNewLink("");
                                  });
                              }}
                            >
                              Revoke link
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {tab === "Marketing" && (
                  <>
                    <h2 className="font-medium">Made for your listing.</h2>
                    <p className="text-sm text-muted-foreground">
                      Create flip-through video and book photos from the public preview only. Your
                      unselected pages never enter these exports.
                    </p>
                    <Button
                      disabled={!preview}
                      onClick={() => void run("Preparing video", () => exportMarketing("video"))}
                    >
                      Create listing video
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!preview}
                      onClick={() =>
                        void run("Preparing photoshoot", () => exportMarketing("photo"))
                      }
                    >
                      Create product images
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      HD video and image downloads require Personal or Business. Check your
                      marketplace's current video requirements before uploading.
                    </p>
                    <Button
                      variant="outline"
                      disabled={p.status !== "published"}
                      onClick={() =>
                        void run("Copying preview link", async () => {
                          await navigator.clipboard.writeText(
                            `https://portfolia.site/product/${id}`,
                          );
                          setMessage("Public preview link copied.");
                        })
                      }
                    >
                      Copy public preview link
                    </Button>
                  </>
                )}
              </fieldset>
              <details className="mt-10 border-t pt-4 text-xs">
                <summary>Product management</summary>
                <div className="flex flex-col items-start gap-4 mt-4">
                  {p.status === "published" && (
                    <button
                      disabled={!!busy}
                      className="underline"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Unpublish this product? Public previews and customer editions will become unavailable.",
                          )
                        )
                          void run("Unpublishing", () => save("draft"));
                      }}
                    >
                      Unpublish product
                    </button>
                  )}
                  <button
                    disabled={!!busy}
                    className="text-destructive underline"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Permanently delete this product, all uploaded editions and every customer link?",
                        )
                      )
                        void run("Deleting", async () => {
                          await deleteProduct({
                            data: { id, confirm: "DELETE" },
                            headers: await productAuth(),
                          });
                          setBaseline(JSON.stringify(p));
                          window.location.assign("/products");
                        });
                    }}
                  >
                    Delete product and files
                  </button>
                </div>
              </details>
            </section>
            <section className="min-w-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  Editor preview · changes are not public until saved
                </p>
                <select
                  aria-label="Edition to preview"
                  className="rounded-lg border p-2 text-xs bg-background"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value as "full" | "preview")}
                >
                  <option value="full">Customer edition</option>
                  <option value="preview">Public preview</option>
                </select>
              </div>
              <div className="rounded-2xl border overflow-hidden min-h-[480px]">
                {source ? (
                  <PdfViewer
                    source={source}
                    fileName={p.title}
                    viewer={viewer}
                    allowDownload={false}
                  />
                ) : (
                  <div className="p-16 text-center text-muted-foreground">
                    {edition === "full"
                      ? "Upload your customer PDF to begin."
                      : "Generate a preview to see the selected pages here."}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
      {marketing && (
        <Suspense fallback={<p role="status">Preparing marketing tools…</p>}>
          {marketing.kind === "video" ? (
            <VideoExportPanel listing p={marketing.portfolio} onClose={() => setMarketing(null)} />
          ) : (
            <PhotoShoot p={marketing.portfolio} onClose={() => setMarketing(null)} />
          )}
        </Suspense>
      )}
    </div>
  );
}
