import { BookMarketingSettings } from "./BookMarketingSettings";
import { LiveScrapbookContext, type ScrapbookSelection } from "./live-scrapbook-context";
import { ScrapbookQuickPanel } from "./ScrapbookQuickPanel";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Book as BookIcon, Camera, ChartNoAxesColumn, BookOpen, ChevronRight, ChevronsLeft, ChevronsRight, GripHorizontal, FolderOpen, Image as ImageIcon, Megaphone, Share2, StickyNote, Sun, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/pf/Chrome";
import { ScrapbookDialog, type ScrapbookPanel } from "@/components/pf/FoldoutSettings";
import { ProjectSettings } from "@/components/pf/ProjectSettings";
import { ShareActions } from "@/components/pf/ShareActions";
import { StyleForm } from "@/components/pf/StyleForm";
import { Segmented } from "@/components/pf/viewer-ui";
import { formatBytes } from "@/lib/portfolia/assets";
import { DEFAULT_VIEWER, isPaid, patchPortfolio, useDoc, type Portfolio } from "@/lib/portfolia/store";
import { OPEN_EMAIL_GAP_HOURS } from "@/lib/portfolia/open-notify";

/** Opt-in "someone opened your portfolio" email (Personal, signed in: it goes to the account's address). */
function OpenEmailSetting({ p, onSaveError }: { p: Portfolio; onSaveError: (message: string | null) => void }) {
  const doc = useDoc();
  const allowed = isPaid(doc) && doc.account.signedIn;
  return (
    <label className="flex items-start justify-between gap-3 text-sm">
      <span>
        <span className="flex items-center gap-2">Email me when someone opens it{!isPaid(doc) && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Personal</span>}</span>
        <span className="block text-xs text-muted-foreground">
          {allowed
            ? `Sent to your account email with the time, country and device. At most one every ${OPEN_EMAIL_GAP_HOURS} hours; opens in between are added to the next. Your own visits don’t count.`
            : isPaid(doc) ? "Sign in to get these emails at your account’s address." : "Personal emails you when someone opens your published portfolio."}
        </span>
      </span>
      <input type="checkbox" className="mt-1" disabled={!allowed} checked={allowed && Boolean(p.notifyOnOpen)} onChange={(e) => onSaveError(patchPortfolio({ notifyOnOpen: e.target.checked }) ? null : "Couldn’t save that setting.")} />
    </label>
  );
}
import { getPreviewLook, pinPreviewLook, subscribePreviewLook, type PreviewLook } from "@/lib/portfolia/preview-look";
import { setBookInset } from "@/lib/portfolia/book-framing";
import { readablePageLinks, readablePageTags } from "@/lib/portfolia/page-extras";
import { readableFoldouts } from "@/lib/portfolia/foldouts";
import { cn } from "@/lib/utils";
import { EditorFullscreenContext, useEditorFullscreen } from "./editor-fullscreen";
import { openingLook } from "@/lib/portfolia/appearance";

const PhotoShoot=lazy(()=>import("./PhotoShoot").then(module=>({default:module.PhotoShoot})));

type Tool = "shoot" | "book" | "customise" | "profile" | "reading" | "look" | "paper" | "background" | "scrapbook" | "projects" | "publish" | "share" | "statistics";
/** The dock, in three groups: how the book looks, what is on it, and getting it out. */
const TOOL_GROUPS: Array<Array<[Tool, string, typeof Sun]>> = [
  [
    ["paper", "Book & turns", BookIcon],
    ["look", "Light & shade", Sun],
    ["background", "Background", ImageIcon],
    ["reading", "Reading modes", BookOpen],
  ],
  [
    ["scrapbook", "Scrapbook", StickyNote],
    ["projects", "Projects", FolderOpen],
    ["book", "Book marketing", Megaphone],
    ["shoot", "Photo shoot", Camera],
  ],
  [
    ["share", "Share", Share2],
    ["statistics", "Statistics", ChartNoAxesColumn],
    ["publish", "File & publishing", Upload],
  ],
];
const TOOLS = TOOL_GROUPS.flat();
/** One line under each panel's title saying what it changes. */
const TOOL_HINTS: Partial<Record<Tool, string>> = {
  paper: "The kind of book, how its pages turn, and the paper.",
  look: "Simple and Studio: shadows, shading and light.",
  background: "What sits behind the book.",
  reading: "How visitors can read: flipbook, scroll or page by page.",
  scrapbook: "Notes, tabs, links, videos and spotlights on pages.",
  customise: "Choose what to change.",
};
const PANEL_WIDE_KEY = "pf-panel-wide";

/** The bar across the top of the editor: where you are, whether it is saved, how the book looks, and publishing. */
export function EditorBar({
  p,
  status,
  onPublish,
  onUnpublish,
  onSave,
  saving,
}: {
  p: Portfolio;
  status: ReactNode;
  onSave?: () => void;
  saving?: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const viewer = { ...DEFAULT_VIEWER, ...p.viewer };
  const [look, setLook] = useState<PreviewLook | null>(getPreviewLook());
  useEffect(() => subscribePreviewLook(setLook), []);
  useEffect(() => () => pinPreviewLook(null), []);
  const shown: PreviewLook = look ?? openingLook(viewer, viewer.mode);
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3 sm:px-5">
      <Link to="/dashboard" aria-label="Back to your portfolios" title="Your portfolios" className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="size-4" /></Link>
      <Wordmark className="shrink-0" />
      <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
      <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">{p.name || p.profile.name || p.pdf?.name}</span>
      <div className="mx-auto flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden />
          {status}
        </span>
        {(
          <div className="hidden w-fit rounded-full bg-muted p-0.5 sm:block">
            <Segmented
              label="Preview appearance"
              value={shown}
              options={[["clean", "Simple"], ["studio", "Studio"]] as const}
              onChange={(value) => pinPreviewLook(value)}
            />
          </div>
        )}
      </div>
      {onSave && <Button size="sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}
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
  statistics,
  onSaveError,
  onDialog,
  onPublish,
  onUnpublish,
  home = false,
  onUpload,
  profile,
}: {
  home?: boolean;
  onUpload?: () => void;
  profile?: ReactNode;
  p: Portfolio;
  preview: ReactNode;
  statistics?: ReactNode;
  onSaveError: (message: string | null) => void;
  onDialog: (dialog: "replace" | "unpublish" | "delete") => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const fullscreen = useEditorFullscreen(stageRef);
  const dockRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const clampPosition = (left: number, top: number) => {
    const stage = stageRef.current, dock = dockRef.current;
    if (!stage || !dock) return { left, top };
    return {
      left: Math.max(8, Math.min(left, Math.max(8, stage.clientWidth - dock.offsetWidth - 8))),
      top: Math.max(8, Math.min(top, Math.max(8, stage.clientHeight - dock.offsetHeight - 8))),
    };
  };
  useEffect(() => {
    const observer = new ResizeObserver(() => setPosition(current => current ? clampPosition(current.left, current.top) : null));
    if (stageRef.current) observer.observe(stageRef.current);
    if (dockRef.current) observer.observe(dockRef.current);
    return () => observer.disconnect();
  }, []);
  const [tool, setTool] = useState<Tool | null>(null);
  // A wider panel, remembered on this device.
  const [wide, setWide] = useState(() => { try { return localStorage.getItem(PANEL_WIDE_KEY) === "1"; } catch { return false; } });
  const toggleWide = () => setWide((current) => { try { localStorage.setItem(PANEL_WIDE_KEY, current ? "0" : "1"); } catch { /* not remembered */ } return !current; });
  const [scrapbook, setScrapbook] = useState<ScrapbookPanel | null>(null);
  const [selection, setSelection] = useState<ScrapbookSelection>(null);
  const [shownPages, setShownPages] = useState<Array<{ page: number; half?: "left" | "right" }>>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !scrapbook) setTool(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrapbook]);
  // Fit the book to the full-height canvas; opening tools must not shrink it.
  useEffect(() => {
    setBookInset(0);
  }, []);
  useEffect(() => () => setBookInset(0), []);
  const pdf = p.pdf!;
  const notes = readableFoldouts(pdf.foldouts, pdf.pages).length;
  const tabs = readablePageTags(pdf.tags, pdf.pages).length;
  const links = readablePageLinks(pdf.links, pdf.pages).length;
  const title = tool === "customise" ? "Customise" : tool === "profile" ? "Profile" : TOOLS.find(([id]) => id === tool)?.[1];
  const row = "flex items-center justify-between gap-3";
  return (
    <EditorFullscreenContext.Provider value={fullscreen}>
    <LiveScrapbookContext.Provider value={{portfolio:p,enabled:tool==="scrapbook"&&!scrapbook,onError:onSaveError,selected:selection,onSelect:setSelection,onPages:setShownPages}}>
    <div ref={stageRef} data-fullscreen={fullscreen.full || undefined} style={fullscreen.full ? { height: "100dvh" } : undefined} className={cn("pf-editor-stage overflow-hidden bg-muted/50", fullscreen.fallback ? "fixed inset-0 z-[200]" : "relative h-[calc(100dvh-3.5rem)]")}>
      <div className="absolute inset-0 overflow-auto" onPointerDown={() => undefined}>
        {preview}
      </div>
      {home && <nav aria-label="Portfolio workspace tools" className="pf-home-toolbar absolute bottom-7 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-border bg-background/95 p-2 shadow-lift backdrop-blur">
        <Button size="sm" onClick={onUpload}><Upload className="size-4" /> <span>Upload PDF</span></Button>
        {([["customise", "Customise", Sun], ["shoot", "Photo shoot", Camera], ["share", "Share", Share2]] as const).map(([id, label, Icon]) => <Button key={id} size="sm" variant="quiet" aria-pressed={tool === id} onClick={() => setTool(current => current === id ? null : id)}><Icon className="size-4" /><span>{label}</span></Button>)}
      </nav>}
      {!home && <nav
        ref={dockRef}
        aria-label="Editing tools"
        style={position ? { left: position.left, top: position.top, bottom: "auto", right: "auto", transform: "none", translate: "none" } : undefined}
        className="absolute bottom-12 left-3 z-40 flex max-h-[calc(100%-4rem)] max-w-[calc(100%-1rem)] flex-col rounded-2xl border border-border bg-background/95 p-1.5 shadow-soft backdrop-blur lg:bottom-auto lg:left-4 lg:top-1/2 lg:max-h-[calc(100%-1rem)] lg:-translate-y-1/2"
      >
        <button
          type="button"
          aria-label="Move editing tools"
          title="Drag to move · arrow keys to nudge · Home to reset"
          className={cn("flex h-7 shrink-0 touch-none select-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2", dragging ? "cursor-grabbing" : "cursor-grab")}
          onPointerDown={e => {
            if (e.button !== 0 || !stageRef.current || !dockRef.current) return;
            e.preventDefault();
            const stage = stageRef.current.getBoundingClientRect(), dock = dockRef.current.getBoundingClientRect();
            dragRef.current = { x: e.clientX, y: e.clientY, left: dock.left - stage.left, top: dock.top - stage.top };
            setPosition(clampPosition(dock.left - stage.left, dock.top - stage.top));
            setDragging(true);
            e.currentTarget.focus({ preventScroll: true });
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={e => {
            const drag = dragRef.current;
            if (drag) setPosition(clampPosition(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y));
          }}
          onPointerUp={e => {
            dragRef.current = null;
            setDragging(false);
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => { dragRef.current = null; setDragging(false); }}
          onLostPointerCapture={() => { dragRef.current = null; setDragging(false); }}
          onDoubleClick={() => setPosition(null)}
          onKeyDown={e => {
            if (e.key === "Home") { e.preventDefault(); e.stopPropagation(); setPosition(null); return; }
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) || !stageRef.current || !dockRef.current) return;
            e.preventDefault(); e.stopPropagation();
            const stage = stageRef.current.getBoundingClientRect(), dock = dockRef.current.getBoundingClientRect(), step = e.shiftKey ? 40 : 10;
            setPosition(clampPosition(dock.left - stage.left + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0), dock.top - stage.top + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0)));
          }}
        ><GripHorizontal className="size-4" aria-hidden /></button>
        <div className="flex min-h-0 gap-1 overflow-auto lg:flex-col">
        {TOOL_GROUPS.map((group, g) => [
          g > 0 && <span key={`gap${g}`} aria-hidden className="mx-0.5 w-px shrink-0 self-stretch bg-border lg:mx-2 lg:my-1 lg:h-px lg:w-auto" />,
          ...group.map(([id, label, Icon]) => (
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
        ))])}
        </div>
      </nav>}
      {tool && tool !== "shoot" && (
        <section
          aria-label={title}
          className={cn("pf-panel absolute inset-x-2 bottom-36 z-30 max-h-[62%] overflow-y-auto overflow-x-hidden overscroll-contain [overflow-wrap:anywhere] rounded-3xl border border-border/80 bg-background/95 px-5 pb-5 shadow-lift backdrop-blur-xl [scrollbar-width:thin] lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:transition-[width] lg:duration-300", wide ? "lg:w-[31rem]" : "lg:w-[23rem]")}
        >
          <div className="sticky top-0 z-10 -mx-5 mb-4 flex items-start justify-between gap-2 border-b border-border/70 bg-background/90 px-5 pb-3 pt-4 backdrop-blur-xl">
            <div className="flex min-w-0 items-start gap-2">
              {tool !== "customise" && <button type="button" onClick={() => setTool("customise")} aria-label="Back to customise options" className="-ml-1.5 mt-0.5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" /></button>}
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
                {TOOL_HINTS[tool] && <p className="mt-0.5 text-xs text-muted-foreground">{TOOL_HINTS[tool]}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <button type="button" aria-label={wide ? "Narrower panel" : "Wider panel"} title={wide ? "Narrower" : "Wider"} aria-pressed={wide} className="hidden rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:block" onClick={toggleWide}>
                {wide ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
              </button>
              <button type="button" aria-label="Close panel" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setTool(null)}>
                <X className="size-4" />
              </button>
            </div>
          </div>
          {tool === "customise" && <div className="space-y-5">
            <label className="block text-xs">Portfolio name<input aria-label="Portfolio name" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40" value={p.name ?? ""} maxLength={120} placeholder={p.pdf?.name ?? "My portfolio"} onChange={e=>patchPortfolio({name:e.target.value})} /></label>
            {([["Design", TOOL_GROUPS[0]!], ["On the pages", TOOL_GROUPS[1]!.filter(([id]) => id !== "shoot")], ["More", [["profile", "Profile details", BookOpen] as [Tool, string, typeof Sun], ...TOOL_GROUPS[2]!.filter(([id]) => id !== "share")]]] as const).map(([heading, items]) => (
              <div key={heading} className="space-y-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{heading}</h3>
                <div className="overflow-hidden rounded-2xl border border-border/80">
                  {items.map(([id, label, Icon]) => (
                    <button key={id} type="button" onClick={() => setTool(id)} className="flex w-full items-center gap-3 border-t border-border/70 px-3 py-2.5 text-left text-sm transition-colors first:border-t-0 hover:bg-muted/60">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{label}</span>
                        {TOOL_HINTS[id] && <span className="block truncate text-xs text-muted-foreground">{TOOL_HINTS[id]}</span>}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>}
          {tool === "profile" && profile}
          {tool === "statistics" && (statistics ?? <p className="text-sm text-muted-foreground">Sign in to see portfolio statistics.</p>)}
          {tool === "reading" && <StyleForm sidebar part="reading" p={p} onSaveError={onSaveError} />}
          {tool === "look" && <StyleForm sidebar part="look" p={p} onSaveError={onSaveError} />}
          {tool === "paper" && <StyleForm sidebar part="paper" p={p} onSaveError={onSaveError} />}
          {tool === "book" && <BookMarketingSettings p={p} />}
          {tool === "background" && <StyleForm sidebar part="background" p={p} onSaveError={onSaveError} />}
          {tool === "projects" && <ProjectSettings key={`${p.code}:${pdf.blobKey}`} p={p} />}
          {tool === "scrapbook" && <ScrapbookQuickPanel p={p} shown={shownPages} selected={selection} onSelect={setSelection} onOpen={setScrapbook} onError={onSaveError} counts={{ notes, tabs, links }} />}
          {tool === "share" && <>{home && <Button className="mb-4 w-full" onClick={onPublish}>{p.status === "published" ? "Save & view sharing options" : "Publish portfolio"}</Button>}<ShareActions p={p} /></>}
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
                <OpenEmailSetting p={p} onSaveError={onSaveError} />
              </div>
              <div className="grid gap-2 border-t border-border pt-4">
                {!home && <Button asChild variant="line" size="sm"><Link to="/dashboard">Back to dashboard</Link></Button>}
                {home ? <Button variant="quiet" size="sm" onClick={() => setTool("profile")}>Edit profile details</Button> : <Button asChild variant="quiet" size="sm"><Link to="/create">Edit profile details</Link></Button>}
              </div>
            </div>
          )}
        </section>
      )}
      {tool === "shoot" && <Suspense fallback={<div role="status" className="absolute inset-0 z-50 flex items-center justify-center bg-background">Opening photo shoot…</div>}><PhotoShoot p={p} onClose={()=>setTool(null)}/></Suspense>}
      <ScrapbookDialog p={p} open={scrapbook !== null} onOpenChange={(open) => !open && setScrapbook(null)} panel={scrapbook ?? "notes"} />
    </div>
    </LiveScrapbookContext.Provider>
    </EditorFullscreenContext.Provider>
  );
}
