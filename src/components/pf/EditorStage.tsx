import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, FolderOpen, Image as ImageIcon, Palette, Share2, StickyNote, Sun, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/pf/Chrome";
import { ScrapbookDialog, type ScrapbookPanel } from "@/components/pf/FoldoutSettings";
import { ProjectSettings } from "@/components/pf/ProjectSettings";
import { ShareActions } from "@/components/pf/ShareActions";
import { StyleForm } from "@/components/pf/StyleForm";
import { Segmented } from "@/components/pf/viewer-ui";
import { formatBytes } from "@/lib/portfolia/assets";
import { DEFAULT_VIEWER, patchPortfolio, type Portfolio } from "@/lib/portfolia/store";
import { getPreviewLook, pinPreviewLook, subscribePreviewLook, type PreviewLook } from "@/lib/portfolia/preview-look";
import { readablePageLinks, readablePageTags } from "@/lib/portfolia/page-extras";
import { readableFoldouts } from "@/lib/portfolia/foldouts";
import { cn } from "@/lib/utils";

type Tool = "reading" | "look" | "background" | "scrapbook" | "projects" | "style" | "publish" | "share";
const TOOLS: Array<[Tool, string, typeof Sun]> = [
  ["reading", "Reading", BookOpen],
  ["look", "Lighting & look", Sun],
  ["background", "Background", ImageIcon],
  ["scrapbook", "Scrapbook", StickyNote],
  ["projects", "Projects", FolderOpen],
  ["style", "Page style", Palette],
  ["share", "Share", Share2],
  ["publish", "File & publishing", Upload],
];

/** The bar across the top of the editor: where you are, whether it is saved, how the book looks, and publishing. */
export function EditorBar({
  p,
  status,
  onPublish,
  onUnpublish,
}: {
  p: Portfolio;
  status: ReactNode;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const viewer = { ...DEFAULT_VIEWER, ...p.viewer };
  const [look, setLook] = useState<PreviewLook | null>(getPreviewLook());
  useEffect(() => subscribePreviewLook(setLook), []);
  useEffect(() => () => pinPreviewLook(null), []);
  const hasBook = (viewer.modes?.length ? viewer.modes : ["scroll", "paged", "book"]).includes("book");
  const shown: PreviewLook = look ?? viewer.look;
  return (
    <header className="relative z-20 flex h-14 items-center gap-3 border-b border-border bg-background px-3 sm:px-5">
      <Wordmark className="shrink-0" />
      <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
      <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">{p.profile.name || p.pdf?.name}</span>
      <div className="mx-auto flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden />
          {status}
        </span>
        {hasBook && (
          <div className="hidden w-44 rounded-full bg-muted p-0.5 sm:block">
            <Segmented
              label="Preview the book in"
              value={shown}
              options={[["clean", "Simple"], ["studio", "Studio"]] as const}
              onChange={(value) => pinPreviewLook(value)}
            />
          </div>
        )}
      </div>
      <Button asChild size="sm" variant="line">
        <Link to="/p/$slug" params={{ slug: p.code }} search={{ preview: "1" }}>Preview</Link>
      </Button>
      {p.status === "published" ? (
        <Button size="sm" variant="line" onClick={onUnpublish}>Unpublish</Button>
      ) : (
        <Button size="sm" onClick={onPublish}>Publish</Button>
      )}
    </header>
  );
}

/**
 * The edit stage: the book fills the space, a slim dock of tools sits on its left, and choosing a tool opens its
 * options in a card on the right.
 */
export function EditorStage({
  p,
  preview,
  onSaveError,
  onDialog,
  onPublish,
  onUnpublish,
}: {
  p: Portfolio;
  preview: ReactNode;
  onSaveError: (message: string | null) => void;
  onDialog: (dialog: "replace" | "unpublish" | "delete") => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [scrapbook, setScrapbook] = useState<ScrapbookPanel | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !scrapbook) setTool(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrapbook]);
  const pdf = p.pdf!;
  const notes = readableFoldouts(pdf.foldouts, pdf.pages).length;
  const tabs = readablePageTags(pdf.tags, pdf.pages).length;
  const links = readablePageLinks(pdf.links, pdf.pages).length;
  const title = TOOLS.find(([id]) => id === tool)?.[1];
  const row = "flex items-center justify-between gap-3";
  return (
    <div className="relative h-[calc(100svh-3.5rem)] min-h-[520px] overflow-hidden bg-muted/50">
      <div className="absolute inset-0 overflow-auto pb-16 lg:pb-0 lg:pl-20" onPointerDown={() => undefined}>
        {preview}
      </div>
      <nav
        aria-label="Editing tools"
        className="absolute inset-x-0 bottom-0 z-20 flex justify-start gap-1 overflow-x-auto border-t border-border bg-background/95 p-2 backdrop-blur lg:inset-x-auto lg:bottom-auto lg:left-4 lg:top-1/2 lg:-translate-y-1/2 lg:flex-col lg:overflow-visible lg:rounded-2xl lg:border lg:p-2 lg:shadow-soft"
      >
        {TOOLS.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={tool === id}
            title={label}
            onClick={() => setTool((current) => (current === id ? null : id))}
            className={cn(
              "group relative flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-muted",
              tool === id && "bg-leaf-soft text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block">
              {label}
            </span>
          </button>
        ))}
      </nav>
      {tool && (
        <section
          aria-label={title}
          className="absolute inset-x-2 bottom-[4.25rem] z-30 max-h-[62%] overflow-auto rounded-2xl border border-border bg-background p-4 shadow-soft lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:w-[22rem]"
        >
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-medium">{title}</h2>
            <button type="button" aria-label="Close panel" className="rounded-full p-1.5 hover:bg-muted" onClick={() => setTool(null)}>
              <X className="size-4" />
            </button>
          </div>
          {tool === "reading" && <StyleForm sidebar part="reading" p={p} onSaveError={onSaveError} />}
          {tool === "look" && <StyleForm sidebar part="look" p={p} onSaveError={onSaveError} />}
          {tool === "background" && <StyleForm sidebar part="background" p={p} onSaveError={onSaveError} />}
          {tool === "style" && <StyleForm sidebar part="appearance" p={p} onSaveError={onSaveError} />}
          {tool === "projects" && <ProjectSettings key={`${p.code}:${pdf.blobKey}`} p={p} />}
          {tool === "scrapbook" && (
            <div className="space-y-3 text-sm">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Make the book feel handmade. Open the scrapbook to place everything on the real pages.
              </p>
              {([
                ["notes", "Fold-out notes", "Text or pictures that unfold from a page", notes],
                ["tabs", "Page tabs", "Coloured tabs on the book's edge that jump to a page", tabs],
                ["links", "Website links", "A logo on the page that opens your site", links],
              ] as const).map(([id, name, hint, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScrapbook(id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted"
                >
                  <span>
                    <span className="block font-medium">{name}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{count}</span>
                </button>
              ))}
            </div>
          )}
          {tool === "share" && <ShareActions p={p} />}
          {tool === "publish" && (
            <div className="space-y-5 text-sm">
              <div>
                <p className="font-medium">{pdf.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{pdf.pages} pages · {formatBytes(pdf.bytes)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="line" onClick={() => onDialog("replace")}>Replace PDF</Button>
                  {p.status === "published" ? (
                    <Button size="sm" variant="line" onClick={onUnpublish}>Unpublish</Button>
                  ) : (
                    <Button size="sm" onClick={onPublish}>Publish</Button>
                  )}
                  <Button size="sm" variant="quiet" onClick={() => onDialog("delete")}>Delete</Button>
                </div>
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <label className={row + " text-sm"}>
                  <span>Let visitors download the PDF</span>
                  <input type="checkbox" checked={p.allowDownload} onChange={(e) => onSaveError(patchPortfolio({ allowDownload: e.target.checked }) ? null : "Couldn’t save that setting.")} />
                </label>
                <label className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    Allow search engines to list my portfolio
                    <span className="block text-xs text-muted-foreground">Off by default. Turning it off doesn’t stop people with your link from viewing it.</span>
                  </span>
                  <input type="checkbox" className="mt-1" checked={Boolean(p.searchIndexing)} onChange={(e) => onSaveError(patchPortfolio({ searchIndexing: e.target.checked }) ? null : "Couldn’t save that setting.")} />
                </label>
              </div>
              <div className="grid gap-2 border-t border-border pt-4">
                <Button asChild variant="line" size="sm"><Link to="/dashboard">Back to dashboard</Link></Button>
                <Button asChild variant="quiet" size="sm"><Link to="/create">Edit profile details</Link></Button>
              </div>
            </div>
          )}
        </section>
      )}
      <ScrapbookDialog p={p} open={scrapbook !== null} onOpenChange={(open) => !open && setScrapbook(null)} panel={scrapbook ?? "notes"} />
    </div>
  );
}
