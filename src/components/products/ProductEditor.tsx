import { BACKGROUND_PRESETS } from "@/lib/portfolia/background-presets";
import { personalBackground } from "@/lib/portfolia/premium-appearance";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import { ArrowLeft, Book as BookIcon, Camera, ChevronRight, ChevronsLeft, ChevronsRight, Eye, FileText, Image as ImageIcon, Megaphone, ScanEye, Share2, Sun, Upload, X } from "lucide-react";
import { Modal, Wordmark } from "@/components/pf/Chrome";
import { Segmented } from "@/components/pf/viewer-ui";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/portfolia/assets";
import { getPreviewLook, pinPreviewLook, subscribePreviewLook, type PreviewLook } from "@/lib/portfolia/preview-look";
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
const field =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";
type Panel = "customise" | "details" | "pages" | "book" | "look" | "background" | "marketing" | "share" | "publish";
/** The same panel set-up as the portfolio editor: a Customise menu leading to one card per topic. */
const TOOLS: Array<[Panel, string, typeof Sun]> = [
  ["book", "Book & turns", BookIcon],
  ["look", "Light & shade", Sun],
  ["background", "Background", ImageIcon],
  ["details", "Product details", FileText],
  ["pages", "Public preview", ScanEye],
  ["marketing", "Listing video & images", Megaphone],
  ["share", "Share", Share2],
  ["publish", "File & publishing", Upload],
];
const GROUPS: Array<[string, Panel[]]> = [
  ["Design", ["book", "look", "background"]],
  ["Product", ["details", "pages"]],
  ["More", ["marketing", "publish"]],
];
const HINTS: Partial<Record<Panel, string>> = {
  customise: "Choose what to change.",
  book: "Page layout and how the pages turn.",
  look: "Simple and Studio: light, shade and paper.",
  background: "What sits behind the book.",
  details: "The description and where shoppers buy it.",
  pages: "The free pages shoppers can see.",
  marketing: "Made from the public preview only.",
  share: "The public preview link and customer access links.",
  publish: "The customer PDF, downloads, publishing and deleting.",
};
const PANEL_WIDE_KEY = "pf-panel-wide";
export function ProductEditor({ id }: { id: string }) {
  const [p, setP] = useState<Product | null>(null),
    [baseline, setBaseline] = useState(""),
    [personal, setPersonal] = useState(false),
    [limit, setLimit] = useState(30),
    [full, setFull] = useState<Blob | null>(null),
    [preview, setPreview] = useState<Blob | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null),
    [dialog, setDialog] = useState<null | "discard" | "unpublish" | "delete">(null),
    [revoking, setRevoking] = useState<{ id: string; label: string } | null>(null),
    [wide, setWide] = useState(() => {
      try {
        return localStorage.getItem(PANEL_WIDE_KEY) === "1";
      } catch {
        return false;
      }
    }),
    [look, setLook] = useState<PreviewLook | null>(getPreviewLook());
  const fileRef = useRef<HTMLInputElement>(null), leaveRef = useRef(false);
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
  const guardRef = useRef(false);
  guardRef.current = dirty || !!busy;
  const blocker = useBlocker({
    shouldBlockFn: () => guardRef.current && !leaveRef.current,
    enableBeforeUnload: () => guardRef.current && !leaveRef.current,
    withResolver: true,
  });
  useEffect(() => subscribePreviewLook(setLook), []);
  useEffect(() => () => pinPreviewLook(null), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dialog) setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);
  const toggleWide = () =>
    setWide((current) => {
      try {
        localStorage.setItem(PANEL_WIDE_KEY, current ? "0" : "1");
      } catch {
        /* not remembered */
      }
      return !current;
    });
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
  const uploadFull = (f: File) =>
    void run("Checking and uploading PDF", async () => {
      if (!p) return;
      if (f.size > limit * 1048576) throw new Error(`Your limit is ${limit} MB.`);
      const js = await loadPdfjs();
      const doc = await js.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      let n = 0;
      try {
        n = doc.numPages;
        if (n > 2000) throw new Error("Please use a PDF with at most 2,000 pages.");
      } finally {
        await doc.destroy();
      }
      const saved = await uploadProductPdf(id, f, f.name, n);
      setFull(f);
      setPreview(null);
      setEdition("full");
      patch({
        title: p.title === "Untitled product" ? f.name.replace(/\.pdf$/i, "").slice(0, 120) : p.title,
        full_file: saved,
        preview_file: null,
        preview_pages: [],
        status: "draft",
      });
      setMessage("PDF uploaded. Choose the public preview pages and save before publishing.");
    });
  const generatePreview = () =>
    void run("Generating preview", async () => {
      if (!p || !full || !p.full_file) return;
      const selected = previewPages(pages, p.full_file.pages);
      const blob = await buildProductPreview(full, selected, (n) =>
        setBusy(`Generating preview ${Math.round(n * 100)}%`),
      );
      if (blob.size > limit * 1048576) throw new Error("Preview is too large. Select fewer pages.");
      const file = await uploadProductPdf(id, blob, "preview.pdf", selected.length);
      setPreview(blob);
      patch({ preview_file: file, preview_pages: selected });
      setEdition("preview");
      setMessage("Preview generated. Check it in the book, then save.");
    });
  const status = busy
    ? `${busy}…`
    : error && p
      ? "Changes not saved"
      : dirty
        ? "Unsaved changes"
        : p?.status === "published"
          ? "Published"
          : "Private draft";
  const shownLook: PreviewLook = look ?? viewer.look ?? "clean";
  const title = panel === "customise" ? "Customise" : TOOLS.find(([key]) => key === panel)?.[1];
  const publishReady = Boolean(p?.preview_file && p.full_file);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-1.5 border-b border-border bg-background px-2 sm:gap-3 sm:px-5">
        <Link to="/products" aria-label="Back to your products" title="Your products" className="shrink-0 rounded-lg p-2 hover:bg-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <Wordmark className="hidden shrink-0 sm:block" />
        <span className="hidden h-6 w-px bg-border lg:block" aria-hidden />
        <span className="hidden min-w-0 max-w-[14rem] truncate text-sm text-muted-foreground lg:block">
          {p?.title ?? "Your product"}
        </span>
        <div className="mx-auto flex min-w-0 flex-col items-center gap-1 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5" role="status" aria-live="polite">
            <span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
            <span className="max-w-[7rem] truncate sm:max-w-none">{status}</span>
          </span>
          {p && (
            <div className="hidden w-fit rounded-full bg-muted p-0.5 sm:block">
              <Segmented
                label="Preview appearance"
                value={shownLook}
                options={[["clean", "Simple"], ["studio", "Studio"]] as const}
                onChange={(value) => pinPreviewLook(value)}
              />
            </div>
          )}
        </div>
        {dirty && (
          <Button size="sm" variant="quiet" className="hidden shrink-0 sm:inline-flex" disabled={!!busy} onClick={() => setDialog("discard")}>
            Discard
          </Button>
        )}
        <Button size="sm" className="shrink-0" disabled={!!busy || !p} onClick={() => void run("Saving", () => save())}>
          Save
        </Button>
        {p?.status === "published" ? (
          <>
            <Button asChild size="sm" variant="line" className="shrink-0">
              <a href={`/product/${id}`} target="_blank" rel="noopener noreferrer" aria-label="Preview">
                <Eye className="sm:hidden" />
                <span className="hidden sm:inline">Preview</span>
              </a>
            </Button>
            <Button size="sm" variant="line" className="shrink-0" disabled={!!busy} onClick={() => setDialog("unpublish")}>
              Unpublish
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="shrink-0"
            disabled={!!busy || !p}
            title={publishReady ? undefined : "Upload the customer PDF and generate a public preview first"}
            onClick={() => {
              if (!publishReady) {
                setPanel(p?.full_file ? "pages" : "publish");
                setError(p?.full_file ? "Generate the public preview before publishing." : "Upload your customer PDF before publishing.");
                return;
              }
              void run("Publishing", () => save("published"));
            }}
          >
            Publish
          </Button>
        )}
      </header>
      <input
        ref={fileRef}
        hidden
        aria-label="Upload complete customer PDF"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) uploadFull(f);
        }}
      />
      <main className="flex-1">
        <div className="pf-editor-stage relative h-[calc(100dvh-3.5rem)] overflow-hidden bg-muted/50">
          <div className="absolute inset-0 overflow-auto">
            {source ? (
              <PdfViewer source={source} fileName={p?.title ?? "product"} viewer={viewer} allowDownload={false} compact />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <div className="max-w-sm rounded-3xl border border-border bg-background p-8 text-center shadow-soft">
                  {!p ? (
                    <p className="text-sm text-muted-foreground">{busy ? `${busy}…` : "Your product couldn’t be loaded."}</p>
                  ) : edition === "full" || !full ? (
                    <>
                      <h2 className="display-title text-2xl">Upload your customer PDF</h2>
                      <p className="mt-2 text-sm text-muted-foreground">It stays private until a customer unlocks their edition. Up to {limit} MB.</p>
                      <Button className="mt-5" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                        <Upload className="size-4" /> Upload PDF
                      </Button>
                    </>
                  ) : (
                    <>
                      <h2 className="display-title text-2xl">No public preview yet</h2>
                      <p className="mt-2 text-sm text-muted-foreground">Choose which pages shoppers can see for free.</p>
                      <Button className="mt-5" onClick={() => setPanel("pages")}>Choose preview pages</Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          {p && (
            <div className="absolute left-3 top-3 z-30 rounded-full border border-border bg-background/95 p-0.5 shadow-soft backdrop-blur">
              <Segmented
                label="Edition to preview"
                value={edition}
                options={[["full", "Customer edition"], ["preview", "Public preview"]] as const}
                onChange={(value) => setEdition(value)}
              />
            </div>
          )}
          {p && (
            <nav aria-label="Product workspace tools" className="pf-home-toolbar absolute bottom-7 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-border bg-background/95 p-2 shadow-lift backdrop-blur">
              <Button size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> <span>Upload PDF</span>
              </Button>
              <Button size="sm" variant="quiet" aria-pressed={panel === "customise"} onClick={() => setPanel((c) => (c === "customise" ? null : "customise"))}>
                <Sun className="size-4" />
                <span>Customise</span>
              </Button>
              <Button size="sm" variant="quiet" disabled={!!busy} onClick={() => void run("Preparing photo shoot", () => exportMarketing("photo"))}>
                <Camera className="size-4" />
                <span>Photo shoot</span>
              </Button>
              <Button size="sm" variant="quiet" aria-pressed={panel === "share"} onClick={() => setPanel((c) => (c === "share" ? null : "share"))}>
                <Share2 className="size-4" />
                <span>Share</span>
              </Button>
            </nav>
          )}
          {p && panel && (
            <section
              aria-label={title}
              className={cn(
                "pf-panel absolute inset-x-2 bottom-36 z-30 max-h-[62%] overflow-y-auto overflow-x-hidden overscroll-contain [overflow-wrap:anywhere] rounded-3xl border border-border/80 bg-background/95 px-5 pb-5 shadow-lift backdrop-blur-xl [scrollbar-width:thin] lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:transition-[width] lg:duration-300",
                wide ? "lg:w-[31rem]" : "lg:w-[23rem]",
              )}
            >
              <div className="sticky top-0 z-10 -mx-5 mb-4 flex items-start justify-between gap-2 border-b border-border/70 bg-background/90 px-5 pb-3 pt-4 backdrop-blur-xl">
                <div className="flex min-w-0 items-start gap-2">
                  {panel !== "customise" && (
                    <button type="button" onClick={() => setPanel("customise")} aria-label="Back to customise options" className="-ml-1.5 mt-0.5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <ArrowLeft className="size-4" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
                    {HINTS[panel] && <p className="mt-0.5 text-xs text-muted-foreground">{HINTS[panel]}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <button type="button" aria-label={wide ? "Narrower panel" : "Wider panel"} title={wide ? "Narrower" : "Wider"} aria-pressed={wide} className="hidden rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:block" onClick={toggleWide}>
                    {wide ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
                  </button>
                  <button type="button" aria-label="Close panel" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setPanel(null)}>
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <fieldset disabled={!!busy} className="space-y-5 text-sm disabled:opacity-70">
                {panel === "customise" && (
                  <>
                    <label className="block text-xs">
                      Product title
                      <input aria-label="Product title" className={field} maxLength={120} value={p.title} onChange={(e) => patch({ title: e.target.value })} />
                    </label>
                    {GROUPS.map(([heading, items]) => (
                      <div key={heading} className="space-y-1.5">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{heading}</h3>
                        <div className="overflow-hidden rounded-2xl border border-border/80">
                          {items.map((key) => {
                            const [, label, Icon] = TOOLS.find(([k]) => k === key)!;
                            return (
                              <button key={key} type="button" onClick={() => setPanel(key)} className="flex w-full items-center gap-3 border-t border-border/70 px-3 py-2.5 text-left text-sm transition-colors first:border-t-0 hover:bg-muted/60">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" aria-hidden /></span>
                                <span className="min-w-0 flex-1">
                                  <span className="block">{label}</span>
                                  {HINTS[key] && <span className="block truncate text-xs text-muted-foreground">{HINTS[key]}</span>}
                                </span>
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {panel === "details" && (
                  <>
                    <label className="block text-sm">
                      Description
                      <textarea className={field} rows={5} maxLength={3000} value={p.description} onChange={(e) => patch({ description: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                      Shop or listing URL
                      <input type="url" placeholder="https://www.etsy.com/listing/…" className={field} value={p.buy_url} onChange={(e) => patch({ buy_url: e.target.value })} />
                    </label>
                  </>
                )}
                {panel === "pages" && (
                  <>
                    <p className="text-muted-foreground">
                      Select specific pages in reading order. The public preview is a separate, flattened PDF: unselected pages and embedded files are excluded.
                    </p>
                    <label className="block text-sm">
                      Page numbers or ranges
                      <input className={field} placeholder="1, 3-5, 9" value={pages} onChange={(e) => setPages(e.target.value)} />
                    </label>
                    <Button className="w-full" disabled={!full} onClick={generatePreview}>Generate preview</Button>
                    <p className="text-xs text-muted-foreground">
                      Current preview: {p.preview_pages.join(", ") || "not generated"}. Up to 40 pages. Regenerate after changing the selection.
                    </p>
                  </>
                )}
                {panel === "book" && (
                  <>
                    <label className="block text-sm">
                      Page layout
                      <select className={field} value={viewer.spreads} onChange={(e) => setViewer({ spreads: e.target.value as "single" | "ready" })}>
                        <option value="single">Individual PDF pages</option>
                        <option value="ready">PDF pages are complete spreads</option>
                      </select>
                    </label>
                    <PageTurnSettings showTabs={false} showTest={false} viewer={viewer} setViewer={setViewer} pages={edition === "full" ? p.full_file?.pages : p.preview_file?.pages} />
                  </>
                )}
                {panel === "look" && (
                  <>
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">How the product opens</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["clean", "studio"] as const).map((value) => (
                          <button
                            type="button"
                            aria-pressed={viewer.look === value}
                            key={value}
                            className={cn("rounded-xl border p-3 text-sm", viewer.look === value ? "border-foreground" : "border-border")}
                            onClick={() => {
                              setViewer({ look: value });
                              pinPreviewLook(value);
                            }}
                          >
                            {value === "clean" ? "Simple" : "Studio"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {viewer.look === "studio" ? (
                      <>
                        <StudioLightingSettings viewer={viewer} setViewer={setViewer} />
                        <PaperSettings viewer={viewer} setViewer={setViewer} />
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Choose Studio for photographic lighting and paper.</p>
                    )}
                  </>
                )}
                {panel === "background" && (
                  <>
                    <label className="flex items-center justify-between text-sm">
                      Background colour
                      <input type="color" value={viewer.backgroundColor ?? "#e9e5dc"} onChange={(e) => setViewer({ backgroundColor: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                      Background texture
                      <select className={field} value={viewer.backgroundPreset ?? ""} onChange={(e) => setViewer({ backgroundPreset: e.target.value || undefined })}>
                        <option value="">Solid colour</option>
                        {[false, true].map((paid) => (
                          <optgroup key={String(paid)} label={paid ? "Personal" : "Free"}>
                            {BACKGROUND_PRESETS.filter((b) => personalBackground(b.id) === paid).map((b) => (
                              <option key={b.id} value={b.id}>{b.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {panel === "marketing" && (
                  <>
                    <p className="text-muted-foreground">
                      Create a flip-through video and book photos from the public preview only. Your unselected pages never enter these exports.
                    </p>
                    <Button className="w-full" disabled={!preview} onClick={() => void run("Preparing video", () => exportMarketing("video"))}>
                      Create listing video
                    </Button>
                    <Button className="w-full" variant="line" disabled={!preview} onClick={() => void run("Preparing photo shoot", () => exportMarketing("photo"))}>
                      Create product images
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      HD video and image downloads require Personal or Business. Check your marketplace's current video requirements before uploading.
                    </p>
                  </>
                )}
                {panel === "share" && (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Public preview</h3>
                      {p.status === "published" ? (
                        <>
                          <input aria-label="Public preview link" readOnly value={`https://portfolia.site/product/${id}`} className={field} />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => void run("Copying preview link", async () => { await navigator.clipboard.writeText(`https://portfolia.site/product/${id}`); setMessage("Public preview link copied."); })}>Copy link</Button>
                            <Button asChild size="sm" variant="line"><a href={`/product/${id}`} target="_blank" rel="noopener noreferrer">Open</a></Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Publish the product to get a public preview link for your listing.</p>
                      )}
                    </div>
                    <div className="space-y-4 border-t border-border pt-4">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Customer access</h3>
                      <p className="text-xs text-muted-foreground">
                        Create a shared link for your shop, or a separate labelled link for an individual order. Anyone with a link can use it. Links are not automatic proof of purchase.
                      </p>
                      <label className="block text-sm">
                        Link label
                        <input className={field} maxLength={100} value={label} onChange={(e) => setLabel(e.target.value)} />
                      </label>
                      <label className="block text-sm">
                        Optional expiry
                        <input type="datetime-local" className={field} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                      </label>
                      <Button
                        className="w-full"
                        disabled={p.status !== "published" || dirty}
                        onClick={() =>
                          void run("Creating access", async () => {
                            const result = await createProductLink({
                              data: { id, label, expiresAt: expiry ? new Date(expiry).toISOString() : null },
                              headers: await productAuth(),
                            });
                            setNewLink(result.url);
                            setLinks([{ id: result.id, label, revoked: false, expires_at: expiry ? new Date(expiry).toISOString() : null }, ...links]);
                          })
                        }
                      >
                        Create customer link
                      </Button>
                      {(p.status !== "published" || dirty) && <p className="text-xs text-muted-foreground">Save and publish before creating access links.</p>}
                      {newLink && (
                        <div className="space-y-3 rounded-2xl border border-border p-4">
                          <p className="text-sm font-medium">Save this link now</p>
                          <p className="text-xs text-muted-foreground">For security, it will not be shown again. It is included in the delivery PDF.</p>
                          <input aria-label="New customer link" readOnly value={newLink} className={field} />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="line" onClick={() => void run("Copying", async () => { await navigator.clipboard.writeText(newLink); setMessage("Customer link copied."); })}>Copy link</Button>
                            <Button size="sm" onClick={() => void run("Creating delivery PDF", async () => downloadBlob(await deliverySheet(p.title, newLink), "customer-access.pdf"))}>Download delivery PDF</Button>
                          </div>
                        </div>
                      )}
                      <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
                        <li>Download the delivery PDF and attach it to your shop's digital listing.</li>
                        <li>Explain that the purchase includes a browser-based edition and whether a PDF download is offered.</li>
                        <li>Place the public preview link in your listing where supported. Never place the customer link publicly.</li>
                      </ol>
                      <p className="text-xs text-muted-foreground">
                        Etsy integration uses its digital file delivery. No Etsy connection, order verification or buyer emails are accessed. Revoking a shared shop link affects every customer who received it; update the delivery PDF and help existing buyers.
                      </p>
                      {links.length > 0 && (
                        <div className="overflow-hidden rounded-2xl border border-border/80">
                          {links.map((link) => (
                            <div key={link.id} className="flex items-start justify-between gap-3 border-t border-border/70 px-3 py-2.5 first:border-t-0">
                              <div className="min-w-0">
                                <p className="text-sm">{link.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {link.revoked ? "Revoked" : link.expires_at ? `Expires ${new Date(link.expires_at).toLocaleString()}` : "No expiry"}
                                </p>
                              </div>
                              {!link.revoked && (
                                <Button size="xs" variant="quiet" onClick={() => setRevoking(link)}>Revoke</Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {panel === "publish" && (
                  <>
                    <div>
                      <p className="font-medium">{p.full_file ? p.full_file.name : "No customer PDF yet"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.full_file ? `${p.full_file.pages} pages · ${formatBytes(p.full_file.bytes)}` : "Private until a customer unlocks their edition."} · Up to {limit} MB
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="line" onClick={() => fileRef.current?.click()}>{p.full_file ? "Replace PDF" : "Upload PDF"}</Button>
                        {p.status === "published" ? (
                          <Button size="sm" variant="line" onClick={() => setDialog("unpublish")}>Unpublish</Button>
                        ) : (
                          <Button size="sm" disabled={!publishReady} onClick={() => void run("Publishing", () => save("published"))}>Publish</Button>
                        )}
                        <Button size="sm" variant="quiet" onClick={() => setDialog("delete")}>Delete</Button>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-border pt-4">
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Offer customers a PDF download</span>
                        <input type="checkbox" checked={p.allow_download} onChange={(e) => patch({ allow_download: e.target.checked })} />
                      </label>
                      <p className="text-xs text-muted-foreground">Turning off the download button is not copy protection. Readers can still capture content they can view.</p>
                    </div>
                  </>
                )}
              </fieldset>
            </section>
          )}
          {error && (
            <p role="alert" className="fixed bottom-24 left-1/2 z-50 w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl border border-destructive/20 bg-background p-3 text-sm text-destructive shadow-soft">
              {error}{" "}
              {!p && <button className="underline" onClick={() => void run("Loading product", load)}>Retry</button>}
              <button className="float-right ml-2 text-muted-foreground" aria-label="Dismiss" onClick={() => setError("")}><X className="size-4" /></button>
            </p>
          )}
          {message && !error && (
            <p role="status" className="fixed bottom-24 left-1/2 z-50 w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl border border-border bg-background p-3 text-sm shadow-soft">
              {message}
            </p>
          )}
        </div>
      </main>
      <Modal open={blocker.status === "blocked"} onClose={() => blocker.reset?.()} title="Save changes before leaving?">
        <p>Your product has unsaved changes. Discarding keeps the last saved version.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={!!busy} onClick={() => void run("Saving", async () => { await save(); leaveRef.current = true; blocker.proceed?.(); })}>Save & leave</Button>
          <Button variant="line" disabled={!!busy} onClick={() => { leaveRef.current = true; blocker.proceed?.(); }}>Discard & leave</Button>
          <Button variant="quiet" onClick={() => blocker.reset?.()}>Keep editing</Button>
        </div>
      </Modal>
      <Modal open={dialog === "discard"} onClose={() => setDialog(null)} title="Discard unsaved changes?">
        <p className="text-muted-foreground">Your product goes back to its last saved version.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="line" onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { setDialog(null); void run("Restoring", load); }}>Discard</Button>
        </div>
      </Modal>
      <Modal open={dialog === "unpublish"} onClose={() => setDialog(null)} title="Unpublish product?">
        <p className="text-muted-foreground">Public previews and customer editions will become unavailable. Your files and links are kept.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="line" onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { setDialog(null); void run("Unpublishing", () => save("draft")); }}>Unpublish</Button>
        </div>
      </Modal>
      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete product?">
        <p className="text-muted-foreground">This permanently removes the product, all uploaded editions and every customer link. It cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="line" onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => {
              setDialog(null);
              void run("Deleting", async () => {
                await deleteProduct({ data: { id, confirm: "DELETE" }, headers: await productAuth() });
                leaveRef.current = true;
                window.location.assign("/products");
              });
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
      <Modal open={revoking !== null} onClose={() => setRevoking(null)} title={`Revoke “${revoking?.label ?? ""}”?`}>
        <p className="text-muted-foreground">Everyone using this link will lose future access.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="line" onClick={() => setRevoking(null)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => {
              const link = revoking;
              setRevoking(null);
              if (!link) return;
              void run("Revoking", async () => {
                await revokeProductLink({ data: { id, linkId: link.id }, headers: await productAuth() });
                setLinks((items) => items.map((l) => (l.id === link.id ? { ...l, revoked: true } : l)));
                setNewLink("");
              });
            }}
          >
            Revoke
          </Button>
        </div>
      </Modal>
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
