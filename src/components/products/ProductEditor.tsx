import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import { ArrowLeft, Book as BookIcon, Camera, ChartNoAxesColumn, ChevronRight, ChevronsLeft, ChevronsRight, Code, Copy, Eye, FileText, Image as ImageIcon, KeyRound, Megaphone, QrCode, ScanEye, Share2, Sun, Upload, X, Zap } from "lucide-react";
import { Modal, Wordmark } from "@/components/pf/Chrome";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { defaultPreviewPages, nextProductStep, type ProductPlan } from "@/lib/products/plan";
import { Segmented } from "@/components/pf/viewer-ui";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/portfolia/assets";
import { getPreviewLook, pinPreviewLook, subscribePreviewLook, type PreviewLook } from "@/lib/portfolia/preview-look";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { PageTurnSettings } from "@/components/pf/PageTurnSettings";
import { BackgroundSettings } from "@/components/pf/BackgroundSettings";
import { PaperSettings, StudioLightingSettings } from "@/components/pf/StudioAppearanceSettings";
import { DEFAULT_VIEWER, type Portfolio, type ViewerSettings } from "@/lib/portfolia/store";
import { putLocalBlob } from "@/lib/portfolia/assets";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { productAuth, readProductPdf, removeProductFiles, uploadProductCover, uploadProductPdf } from "@/lib/products/client";
import { PortfolioQrCode } from "@/components/pf/PortfolioQrCode";
import { ProductStatsPanel } from "./ProductStatsPanel";
import { ProductDeliveryPanel } from "./ProductDeliveryPanel";
import { ProductExtras } from "./ProductExtras";
import { previewPages, previewSpreads, productShareUrl, productSlug, slugFromTitle, stripControl, type Product } from "@/lib/products/model";
import { takePendingProductPdf } from "@/lib/products/pending";
import { buildProductPreview, deliverySheet, downloadBlob, renderProductCover } from "@/lib/products/preview";
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
type Panel = "customise" | "details" | "pages" | "book" | "look" | "background" | "marketing" | "share" | "publish" | "stats" | "delivery";
/** The same panel set-up as the portfolio editor: a Customise menu leading to one card per topic. */
const TOOLS: Array<[Panel, string, typeof Sun]> = [
  ["book", "Book & turns", BookIcon],
  ["look", "Light & shade", Sun],
  ["background", "Background", ImageIcon],
  ["details", "Product details", FileText],
  ["pages", "Public preview", ScanEye],
  ["marketing", "Listing video & images", Megaphone],
  ["share", "Links", Share2],
  ["delivery", "Automatic delivery", Zap],
  ["stats", "Statistics", ChartNoAxesColumn],
  ["publish", "File & publishing", Upload],
];
const GROUPS: Array<[string, Panel[]]> = [
  ["Design", ["book", "look", "background"]],
  ["Product", ["details", "pages", "delivery"]],
  ["More", ["marketing", "stats", "publish"]],
];
const HINTS: Partial<Record<Panel, string>> = {
  customise: "Choose what to change.",
  book: "Page layout and how the pages turn.",
  look: "Simple and Studio: light, shade and paper.",
  background: "What sits behind the book.",
  details: "The description and where shoppers buy it.",
  pages: "The free pages shoppers can see.",
  marketing: "Made from the public preview only.",
  share: "One link for shoppers, one for customers.",
  publish: "The customer PDF, extras, downloads, publishing and deleting.",
  stats: "Views, buy clicks, opens and downloads. Counts only.",
  delivery: "A private link for each buyer, by email.",
};
const PANEL_WIDE_KEY = "pf-panel-wide";
/** Page numbers as short text: [1, 2, 3, 6] becomes "1-3, 6". */
function pageRanges(list: number[]) {
  const parts: string[] = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j]! + 1) j++;
    parts.push(i === j ? `${list[i]}` : `${list[i]}-${list[j]}`);
    i = j;
  }
  return parts.join(", ");
}
export function ProductEditor({ id }: { id: string }) {
  const [p, setP] = useState<Product | null>(null),
    [baseline, setBaseline] = useState(""),
    [personal, setPersonal] = useState(false),
    [plan, setPlan] = useState<ProductPlan>("free"),
    [canPublish, setCanPublish] = useState(false),
    [upgrade, setUpgrade] = useState<null | string>(null),
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
  const [pages, setPages] = useState("1"),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [edition, setEdition] = useState<"full" | "preview">("full");
  const [links, setLinks] = useState<Awaited<ReturnType<typeof ownerProduct>>["links"]>([]),
    [label, setLabel] = useState(""),
    [expiry, setExpiry] = useState(""),
    [newLink, setNewLink] = useState(""),
    [stamp, setStamp] = useState(""),
    [share, setShare] = useState<null | "qr" | "embed">(null),
    // Which plan-1 columns the database has yet (they arrive with migrations the owner applies by hand).
    [columns, setColumns] = useState({ cover_file: true, slug: true, extra_files: true }),
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
    setPlan(data.plan);
    setCanPublish(data.canPublish);
    setLimit(data.limitMb);
    setLinks(data.links);
    setColumns(data.columns);
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
  const save = async (status = p?.status, product = p) => {
    if (!product) return;
    const result = await saveProduct({
      data: { ...product, status: status ?? "draft", appearance: product.appearance as any },
      headers: await productAuth(),
    });
    const saved = { ...product, status: status ?? "draft", revision: result.revision };
    // Covers and extras the product no longer uses are removed once the save has gone through (best effort).
    const before = baseline ? (JSON.parse(baseline) as Partial<Product>) : null;
    const keep = new Set([saved.cover_file?.path, ...(saved.extra_files ?? []).map((x) => x.path)]);
    void removeProductFiles([before?.cover_file?.path, ...(before?.extra_files ?? []).map((x) => x.path)].filter((path): path is string => Boolean(path) && !keep.has(path)));
    setP(saved);
    setBaseline(JSON.stringify(saved));
    if (result.unsupported?.length) setColumns((c) => ({ ...c, ...Object.fromEntries(result.unsupported.map((k) => [k, false])) }));
    setMessage(
      result.unsupported?.length
        ? "Saved. Your address and extra files are available after the next update."
        : saved.status === "published"
          ? "Saved. Your published product is up to date."
          : "Draft saved.",
    );
  };
  const previewUrl = productShareUrl({ id, slug: p?.slug });
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(done);
    } catch {
      setError("Couldn’t copy. Select the link and copy it yourself.");
    }
  };
  /** Put the product online, or say what it still needs. Publishing is part of the paid plans. */
  const publish = () => {
    if (!p) return;
    if (!p.full_file || !p.preview_file) {
      setPanel(p.full_file ? "pages" : "publish");
      setError(p.full_file ? "Choose the public preview pages before publishing." : "Upload your customer PDF before publishing.");
      return;
    }
    if (!canPublish) return setUpgrade("Publishing products");
    void run("Publishing", async () => {
      await save("published");
      setPanel("share");
      setMessage("Published. Your links are ready.");
    });
  };
  const createLink = () =>
    void run("Creating customer link", async () => {
      const expiresAt = expiry ? new Date(expiry).toISOString() : null,
        name = label.trim() || "Shop customers";
      const buyer = stamp.trim() || null;
      const result = await createProductLink({ data: { id, label: name, expiresAt, stamp: buyer }, headers: await productAuth() });
      setNewLink(result.url);
      setLinks((items) => [{ id: result.id, label: name, revoked: false, expires_at: expiresAt, opens: 0, last_opened_at: null, stamp: buyer }, ...items]);
      setLabel("");
      setExpiry("");
      setStamp("");
      try {
        await navigator.clipboard.writeText(result.url);
        setMessage("Customer link created and copied.");
      } catch {
        setMessage("Customer link created. Copy it from the panel.");
      }
    });
  const exportMarketing = async (kind: "video" | "photo") => {
    if (kind === "video" && !personal) return setUpgrade("HD listing videos");
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
      const wasLive = p.status === "published";
      let next: Product = {
        ...p,
        title: p.title === "Untitled product" ? f.name.replace(/\.pdf$/i, "").slice(0, 120) : p.title,
        full_file: saved,
        preview_file: null,
        preview_pages: [],
        status: "draft",
      };
      setFull(f);
      setPreview(null);
      setEdition("full");
      setP(next);
      // A first preview (the cover and first spread) is made straight away, so the product is ready to publish.
      let made = false;
      try {
        const first = await makePreview(f, defaultPreviewPages(n));
        next = { ...next, ...first.values };
        setP(next);
        made = true;
      } catch {
        /* the seller chooses pages by hand instead */
      }
      // A draft is kept as it goes; a product that was online waits for Save, so nothing changes for shoppers by surprise.
      if (!wasLive) await save("draft", next);
      setPanel("pages");
      setMessage(
        made
          ? `PDF uploaded and a first preview made (pages ${pageRanges(next.preview_pages)}). Change the pages here, or publish.`
          : "PDF uploaded. Choose the public preview pages before publishing.",
      );
    });
  // A PDF dropped on a landing page waits in this browser (lib/products/pending.ts): upload it once the product has
  // loaded, then drop ?pending=1 from the address so a reload never uploads it twice.
  const pendingTaken = useRef(false);
  useEffect(() => {
    if (!p || busy || pendingTaken.current || !new URLSearchParams(window.location.search).has("pending")) return;
    pendingTaken.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("pending");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    void takePendingProductPdf().then((file) => {
      if (file) uploadFull(file);
      else setError("The PDF you dropped is no longer waiting. Choose it with Upload PDF.");
    });
  }, [p, busy]);
  /** Builds the separate preview file from chosen pages and stores it. */
  const makePreview = async (blob: Blob, selected: number[]) => {
    const out = await buildProductPreview(blob, selected, (n) =>
      setBusy(`Making preview ${Math.round(n * 100)}%`),
    viewer.previewWatermark ?? false);
    if (out.size > limit * 1048576) throw new Error("Preview is too large. Select fewer pages.");
    const file = await uploadProductPdf(id, out, "preview.pdf", selected.length);
    setPreview(out);
    setPages(pageRanges(selected));
    // Feature A: a cover of public page 1. A cover that fails (old browser, migration not applied) never fails the preview.
    const cover = await makeCover(out);
    return { values: { preview_file: file, preview_pages: selected, ...(cover ? { cover_file: cover } : {}) } };
  };
  const makeCover = async (previewBlob: Blob) => {
    if (!columns.cover_file) return null;
    try {
      return await uploadProductCover(id, await renderProductCover(previewBlob));
    } catch {
      return null;
    }
  };
  // Products whose preview was made before covers existed get one quietly, saved only when nothing else is pending.
  const coverTried = useRef(false);
  useEffect(() => {
    if (!p || busy || dirty || coverTried.current || !preview || p.cover_file || !columns.cover_file) return;
    if (p.status === "published" && !canPublish) return;
    coverTried.current = true;
    void makeCover(preview).then((cover) => {
      if (!cover) return;
      void save(p.status, { ...p, cover_file: cover }).catch(() => {});
    });
  }, [p, busy, dirty, preview, columns.cover_file, canPublish]);
  const generatePreview = () =>
    void run("Making preview", async () => {
      if (!p || !full || !p.full_file) return;
      const made = await makePreview(full, previewPages(pages, p.full_file.pages));
      patch(made.values);
      setEdition("preview");
      setMessage("Preview updated. Check it in the book, then save.");
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
  const step = nextProductStep({ status: p?.status ?? "draft", hasFile: Boolean(p?.full_file), hasPreview: Boolean(p?.preview_file) });
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
        {p && plan === "free" && (
          <button type="button" onClick={() => setUpgrade("Publishing products")} className="hidden shrink-0 rounded-full bg-leaf-soft px-3 py-1.5 text-xs font-medium text-leaf hover:opacity-80 md:block">
            Free try-out · Upgrade to publish
          </button>
        )}
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
            title={publishReady ? (canPublish ? undefined : "Publishing is part of Personal and Business") : "Upload the customer PDF and choose preview pages first"}
            onClick={publish}
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
              {/* The one thing this product needs next is always the main button. */}
              {step === "upload" ? (
                <Button size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" /> <span>Upload PDF</span>
                </Button>
              ) : step === "preview" ? (
                <Button size="sm" disabled={!!busy} onClick={() => setPanel("pages")}>
                  <ScanEye className="size-4" /> <span>Choose preview pages</span>
                </Button>
              ) : step === "publish" ? (
                <Button size="sm" disabled={!!busy} onClick={publish}>
                  <Upload className="size-4" /> <span>Publish</span>
                </Button>
              ) : (
                <Button size="sm" aria-pressed={panel === "share"} onClick={() => setPanel((c) => (c === "share" ? null : "share"))}>
                  <Share2 className="size-4" /> <span>Get links</span>
                </Button>
              )}
              <Button size="sm" variant="quiet" aria-pressed={panel === "customise"} onClick={() => setPanel((c) => (c === "customise" ? null : "customise"))}>
                <Sun className="size-4" />
                <span>Customise</span>
              </Button>
              <Button size="sm" variant="quiet" disabled={!!busy} onClick={() => void run("Preparing photo shoot", () => exportMarketing("photo"))}>
                <Camera className="size-4" />
                <span>Photo shoot</span>
              </Button>
              {step !== "share" && (
                <Button size="sm" variant="quiet" aria-pressed={panel === "share"} onClick={() => setPanel((c) => (c === "share" ? null : "share"))}>
                  <Share2 className="size-4" />
                  <span>Links</span>
                </Button>
              )}
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
              <fieldset disabled={!!busy} className="min-w-0 space-y-5 text-sm disabled:opacity-70">
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
                      Pick the pages shoppers can see for free. The preview is a separate file made only from these pages, so the rest of your PDF never leaves your private edition.
                    </p>
                    {p.full_file && (() => {
                      const total = p.full_file.pages;
                      let chosen: number[] = [1];
                      try { chosen = previewPages(pages, total); } catch {}
                      const has = (a: number, b: number) => chosen.includes(a) && chosen.includes(b);
                      const toggle = (a: number, b: number) => {
                        const set = new Set(chosen);
                        if (has(a, b)) { set.delete(a); set.delete(b); } else { set.add(a); set.add(b); }
                        set.add(1);
                        const list = [...set].sort((x, y) => x - y), parts: string[] = [];
                        for (let i = 0; i < list.length; i++) {
                          let j = i; while (j + 1 < list.length && list[j + 1] === list[j]! + 1) j++;
                          parts.push(i === j ? `${list[i]}` : `${list[i]}-${list[j]}`); i = j;
                        }
                        setPages(parts.join(", "));
                      };
                      return (
                        <div>
                          <p className="mb-2 text-xs text-muted-foreground">Spreads shown to shoppers</p>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-foreground bg-foreground px-3 py-1 text-xs text-background">Cover · always</span>
                            {previewSpreads(total).map(([a, b]) => (
                              <button key={a} type="button" aria-pressed={has(a, b)} onClick={() => toggle(a, b)}
                                className={cn("rounded-full border px-3 py-1 text-xs", has(a, b) ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground")}>
                                {a === b ? a : `${a}–${b}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <label className="block text-sm">
                      Or type pages and spreads
                      <input className={field} placeholder="2-3, 6-7" value={pages} onChange={(e) => setPages(e.target.value)} />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>Watermark the preview<span className="block text-xs text-muted-foreground">A faint “Preview” mark across every page.</span></span>
                      <input type="checkbox" checked={viewer.previewWatermark ?? false} onChange={(e) => setViewer({ previewWatermark: e.target.checked })} />
                    </label>
                    <Button className="w-full" disabled={!full} onClick={generatePreview}>{p.preview_file ? "Update preview" : "Make preview"}</Button>
                    <p className="text-xs text-muted-foreground">
                      Shoppers currently see: {p.preview_pages.length ? `pages ${pageRanges(p.preview_pages)}` : "nothing yet"}. The cover is always included. Up to 40 pages. Update the preview after changing the selection.
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
                  <BackgroundSettings viewer={viewer} defaultColour="#e9e5dc" setViewer={(v) => { const { backgroundKey: _k, ...rest } = v as Partial<ViewerSettings> & { backgroundKey?: string }; setViewer(rest); return true; }} />
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
                      {personal ? "Check your marketplace's current video requirements before uploading." : "On Free you can set up and preview these. HD video and image downloads are part of Personal and Business."}
                    </p>
                  </>
                )}
                {panel === "share" && (
                  <>
                    {p.status !== "published" ? (
                      <div className="rounded-2xl border border-border p-4">
                        <p className="text-sm font-medium">Your two links appear here once the product is online</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {canPublish
                            ? publishReady
                              ? "Publish to get a preview link for your listing and a private link for customers."
                              : "Upload your PDF and choose the preview pages, then publish."
                            : "On Free you can build the product and see how it looks. Publishing and links are part of Personal and Business."}
                        </p>
                        <Button size="sm" className="mt-3" onClick={publish}>{canPublish ? "Publish" : "See plans"}</Button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2.5 rounded-2xl border border-border p-4">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted"><Eye className="size-3.5" aria-hidden /></span>
                            <div className="min-w-0">
                              <h3 className="text-sm font-medium">Preview link</h3>
                              <p className="text-xs text-muted-foreground">For your listing and socials. Shows only the preview pages.</p>
                            </div>
                          </div>
                          <input aria-label="Public preview link" readOnly value={previewUrl} onFocus={(e) => e.currentTarget.select()} className={field} />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => void copy(previewUrl, "Preview link copied.")}><Copy /> Copy link</Button>
                            <Button asChild size="sm" variant="line"><a href={`/product/${id}`} target="_blank" rel="noopener noreferrer">Open</a></Button>
                            {/* QR codes and embeds are for the preview only, never for a customer link. */}
                            <Button size="sm" variant="line" onClick={() => setShare("qr")}><QrCode /> QR code</Button>
                            <Button size="sm" variant="line" onClick={() => setShare("embed")}><Code /> Embed</Button>
                          </div>
                          <label className="block pt-1 text-xs">
                            Your address
                            <span className="mt-1.5 flex items-center gap-1">
                              <span className="shrink-0 text-muted-foreground">portfolia.site/product/</span>
                              <input
                                className={field + " mt-0"}
                                maxLength={40}
                                disabled={!columns.slug}
                                placeholder={columns.slug ? "my-zine" : "Available after the next update"}
                                value={p.slug ?? ""}
                                onChange={(e) => patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40) || null })}
                              />
                              <Button size="sm" variant="quiet" disabled={!columns.slug} onClick={() => patch({ slug: slugFromTitle(p.title) || null })}>Suggest</Button>
                            </span>
                          </label>
                          {p.slug && !productSlug.safeParse(p.slug).success && <p className="text-xs text-destructive">{productSlug.safeParse(p.slug).error?.issues[0]?.message}</p>}
                          <p className="text-xs text-muted-foreground">Saves with the Save button. Changing it later breaks the old address; the id link always keeps working.</p>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-border p-4">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted"><KeyRound className="size-3.5" aria-hidden /></span>
                            <div className="min-w-0">
                              <h3 className="text-sm font-medium">Customer link</h3>
                              <p className="text-xs text-muted-foreground">For buyers only. Opens the complete edition. Never post it publicly.</p>
                            </div>
                          </div>
                          {newLink ? (
                            <div className="space-y-2.5 rounded-xl bg-leaf-soft/60 p-3">
                              <p className="text-xs font-medium text-leaf">Keep this link now — for security it is shown only once.</p>
                              <input aria-label="New customer link" readOnly value={newLink} onFocus={(e) => e.currentTarget.select()} className={field} />
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => void copy(newLink, "Customer link copied.")}><Copy /> Copy link</Button>
                                <Button size="sm" variant="line" onClick={() => void run("Creating delivery PDF", async () => downloadBlob(await deliverySheet(p.title, newLink), "customer-access.pdf"))}>Download delivery PDF</Button>
                              </div>
                              <p className="text-xs text-muted-foreground">The delivery PDF is a one-page file with an “Open your edition” button. Attach it to your shop’s digital listing.</p>
                            </div>
                          ) : (
                            <Button className="w-full" disabled={dirty} onClick={createLink}><KeyRound /> Create customer link</Button>
                          )}
                          {dirty && !newLink && <p className="text-xs text-muted-foreground">Save your changes first.</p>}
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{newLink ? "Create another link" : "Name it or set an expiry"}</summary>
                            <div className="mt-3 space-y-3">
                              <label className="block">
                                Name (only you see this)
                                <input className={field} maxLength={100} placeholder="Shop customers" value={label} onChange={(e) => setLabel(e.target.value)} />
                              </label>
                              <label className="block">
                                Stops working on (optional)
                                <input type="datetime-local" className={field} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                              </label>
                              {p.allow_download && (
                                <label className="block">
                                  Buyer name or order number (stamped on their download)
                                  <input className={field} maxLength={80} value={stamp} onChange={(e) => setStamp(stripControl(e.target.value))} />
                                  <span className="mt-1 block text-muted-foreground">Printed small at the foot of every page of the PDF they download. A deterrent, not copy protection.</span>
                                </label>
                              )}
                              {newLink && <Button size="sm" variant="line" disabled={dirty} onClick={createLink}>Create link</Button>}
                              <p className="text-muted-foreground">One shared link suits a shop listing. For individual orders, make a link per buyer so you can switch one off without affecting the rest.</p>
                            </div>
                          </details>
                        </div>
                        {links.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Customer links you’ve made</h3>
                            <div className="overflow-hidden rounded-2xl border border-border/80">
                              {links.map((link) => (
                                <div key={link.id} className="flex items-start justify-between gap-3 border-t border-border/70 px-3 py-2.5 first:border-t-0">
                                  <div className="min-w-0">
                                    <p className={cn("truncate text-sm", link.revoked && "text-muted-foreground line-through")}>{link.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {link.revoked ? "Switched off" : link.expires_at ? (Date.parse(link.expires_at) < Date.now() ? "Expired" : `Until ${new Date(link.expires_at).toLocaleDateString()}`) : "No expiry"}
                                      {" · "}
                                      {link.opens ? `Opened ${link.opens} time${link.opens === 1 ? "" : "s"}` : "Not opened yet"}
                                    </p>
                                    {link.stamp && <p className="truncate text-xs text-muted-foreground">Stamped: {link.stamp}</p>}
                                  </div>
                                  {!link.revoked && (
                                    <Button size="xs" variant="quiet" onClick={() => setRevoking(link)}>Switch off</Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <button type="button" className="w-full rounded-2xl border border-border p-4 text-left text-xs hover:bg-muted/50" onClick={() => setPanel("delivery")}>
                          <span className="block text-sm font-medium">Add an order by hand, or deliver automatically</span>
                          <span className="mt-1 block text-muted-foreground">Email one buyer their own link, or let Gumroad, Shopify or Zapier do it for each order.</span>
                        </button>
                        <details className="rounded-2xl border border-border p-4 text-xs">
                          <summary className="cursor-pointer text-sm font-medium">How to deliver through Etsy or another shop</summary>
                          <ol className="mt-3 list-decimal space-y-2 pl-4 text-muted-foreground">
                            <li>Put the preview link in your listing where links are allowed.</li>
                            <li>Create a customer link and download its delivery PDF.</li>
                            <li>Attach the delivery PDF as the listing’s digital file. Your shop sends it after each purchase.</li>
                          </ol>
                          <p className="mt-3 text-muted-foreground">
                            Anyone holding a customer link can open the edition, so it is access control rather than proof of purchase. No shop account is connected and no buyer details are read. Switching a shared link off affects everyone who has it.
                          </p>
                        </details>
                      </>
                    )}
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
                          <Button size="sm" onClick={publish}>Publish</Button>
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
                    <ProductExtras
                      id={id}
                      extras={p.extra_files ?? []}
                      onChange={(next) => patch({ extra_files: next })}
                      paid={canPublish}
                      available={columns.extra_files}
                      limitMb={limit}
                      onUpgrade={() => setUpgrade("Extra files")}
                      run={(label, fn) => void run(label, fn)}
                    />
                  </>
                )}
                {panel === "stats" && <ProductStatsPanel id={id} />}
                {panel === "delivery" && (
                  <ProductDeliveryPanel
                    id={id}
                    business={plan === "business"}
                    published={p.status === "published"}
                    onUpgrade={() => setUpgrade("Automatic delivery")}
                    copy={(text, done) => void copy(text, done)}
                  />
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
      <PortfolioQrCode open={share === "qr"} onClose={() => setShare(null)} url={previewUrl} name={p?.title ?? "Product"} />
      <Modal open={share === "embed"} onClose={() => setShare(null)} title="Embed the preview" description="Paste this code into a website that accepts embeds. It shows only the free preview pages, never the customer edition." wide>
        {(() => {
          const embedUrl = `https://portfolia.site/embed/product/${p?.slug || id}`;
          const safe = (p?.title ?? "Product").replace(/[<>"&]/g, "");
          const code = `<iframe src="${embedUrl}" style="width:100%;aspect-ratio:16/10;border:0" loading="lazy" allow="fullscreen" title="Preview of ${safe}"></iframe>`;
          return <div className="space-y-3">
            <textarea readOnly aria-label="Embed code" rows={4} value={code} onFocus={(e) => e.currentTarget.select()} className={field + " font-mono text-xs"} />
            <Button size="sm" onClick={() => void copy(code, "Embed code copied.")}><Copy /> Copy code</Button>
            <p className="text-xs text-muted-foreground">Your website provider may restrict embeds by plan. If it does, use the preview link instead.</p>
          </div>;
        })()}
      </Modal>
      <UpgradeModal open={upgrade !== null} reason={upgrade ?? undefined} products={{ plan, returnTo: `/product-studio/${id}` }} onClose={() => setUpgrade(null)} />
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
