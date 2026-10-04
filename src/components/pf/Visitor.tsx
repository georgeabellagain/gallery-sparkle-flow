import { useEffect } from "react";
import { Link, useHydrated } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { PortfolioPage, useStoredMedia } from "./PortfolioPage";
import { Wordmark } from "./Chrome";
import { SAMPLE } from "@/lib/portfolia/sample";
import { registerPublicUrls } from "@/lib/portfolia/assets";
import type { PublicPortfolio } from "@/lib/portfolia/public.functions";
import { type ViewerSettings, DEFAULT_VIEWER, findPortfolio, recordDownload, recordVisit, useDoc, type Portfolio } from "@/lib/portfolia/store";

/** Example portfolio; `demo` opens straight into a flipbook preset. */
export function SampleVisitor({ demo }: { demo?: "book" }) {
  const viewer = demo ? { ...DEFAULT_VIEWER, mode: "book" as const } : undefined;
  return (
    <div className="min-h-screen">
      <PortfolioPage profile={SAMPLE.profile} pdf={SAMPLE_SRC} allowDownload immersive viewer={viewer} />
    </div>
  );
}
const SAMPLE_SRC = { url: SAMPLE.pdfUrl };

export function OwnVisitor({ p, preview }: { p: Portfolio; preview: boolean }) {
  const { pdf, photoUrl } = useStoredMedia(p.pdf?.blobKey, p.profile.photoKey);
  useEffect(() => {
    if (!preview && p.status === "published") recordVisit(p.code);
  }, [p.code, p.status, preview]);
  useEffect(() => {
    const tag = document.querySelector('meta[name="robots"]') ?? document.head.appendChild(Object.assign(document.createElement("meta"), { name: "robots" }));
    tag.setAttribute("content", p.searchIndexing && !preview ? "index, follow" : "noindex, nofollow");
  }, [p.searchIndexing, preview]);
  useEffect(() => {
    if (p.profile.name) document.title = `${p.profile.name} — Portfolio`;
  }, [p.profile.name]);
  return (
    <div className="min-h-screen">
      {preview && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-5 py-2 text-xs">
          <span className="flex items-center gap-2"><Eye className="size-3.5" /> Creator preview — not counted as a visit.</span>
          <Link to="/dashboard" className="underline underline-offset-4">Dashboard</Link>
        </div>
      )}
      <PortfolioPage
        profile={p.profile}
        pdf={pdf}
        photoUrl={photoUrl}
        allowDownload={p.allowDownload}
        onDownload={preview ? undefined : () => recordDownload(p.code)}
        pageStyle={p.plan === "personal" ? p.style : undefined}
        viewer={p.viewer}
        cvBlobKey={p.plan === "personal" ? p.profile.cv?.blobKey : undefined}
        immersive
      />
    </div>
  );
}

export function Missing({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="shell flex h-14 items-center rule-b"><Wordmark /></div>
      <div className="flex flex-1 items-center justify-center px-5">
        <div className="max-w-md py-24 text-center">
          <h1 className="display-title text-3xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}

export function useOwn(test: (p: Portfolio) => boolean) {
  return findPortfolio(useDoc(), test);
}

export const LOCAL_MISSING = "Nothing is published at this address. Check the link, or ask the owner to publish it again.";

/** A published portfolio loaded from the server. */
export function CloudVisitor({ data }: { data: NonNullable<PublicPortfolio> }) {
  registerPublicUrls(data.urls);
  const hydrated = useHydrated();
  const own = useOwn((p) => p.code === data.portfolio.code);
  return (
    <div className="relative">
      {/* Bottom-left, so it never covers the viewer's icons at the top. */}
      {hydrated && own && (
        <div className="fixed bottom-3 left-3 z-[70] flex gap-2 rounded-full border border-border bg-background/95 p-1 shadow-soft backdrop-blur">
          <Link to="/edit" className="rounded-full px-3 py-1.5 text-xs font-medium hover:bg-muted">Edit portfolio</Link>
          <Link to="/dashboard" className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Dashboard</Link>
        </div>
      )}
      <OwnVisitor p={data.portfolio} preview={false} />
    </div>
  );
}

/** Compact published viewer for embedding on another website. */
export function EmbeddedVisitor({ data, startPage, mode, background }: { data: NonNullable<PublicPortfolio>; startPage?: number; mode?: "scroll" | "paged" | "book"; background?: ViewerSettings["background"] }) {
  registerPublicUrls(data.urls);
  const p = data.portfolio;
  const { pdf } = useStoredMedia(p.pdf?.blobKey);
  useEffect(() => recordVisit(p.code), [p.code]);
  // A background chosen for the embed replaces the owner's own colour or picture.
  const pageStyle = p.plan === "personal" ? (background && p.style ? { ...p.style, backdrop: "" } : p.style) : undefined;
  return (
    <PortfolioPage
      profile={p.profile}
      pdf={pdf}
      allowDownload={p.allowDownload}
      onDownload={() => recordDownload(p.code)}
      pageStyle={pageStyle}
      viewer={{ ...DEFAULT_VIEWER, ...p.viewer, look: "clean", ...(mode ? { mode } : {}), ...(background ? { background, backgroundColor: undefined, backgroundKey: undefined } : {}), showHeader: false }}
      startPage={startPage}
      immersive
      embed
    />
  );
}
