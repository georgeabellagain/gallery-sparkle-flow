import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Eye,
  Monitor,
  Redo2,
  RefreshCw,
  Smartphone,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorContext, findItem, isPageItem, patchItem, type Selection } from "@/components/editor/editorContext";
import { ContentPanel } from "@/components/editor/ContentPanel";
import { InspectorDesign } from "@/components/editor/InspectorDesign";
import { InspectorItem } from "@/components/editor/InspectorItem";
import { AboutPanel } from "@/components/editor/AboutPanel";
import { VersionsPanel } from "@/components/editor/VersionsPanel";
import { SharePanel } from "@/components/editor/SharePanel";
import { PageCanvas } from "@/components/editor/PageCanvas";
import { Presentation } from "@/components/portfolia/Presentation";
import { ImageViewer, type ViewerTarget } from "@/components/portfolia/ImageViewer";
import { Wordmark } from "@/components/portfolia/SiteChrome";
import {
  layoutFor,
  redo,
  retrySave,
  undo,
  updatePortfolio,
  useHistoryFlags,
  usePortfolio,
  useSaveStatus,
} from "@/lib/portfolia/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({
    meta: [
      { title: "Editor — Portfolia" },
      { name: "description", content: "Arrange your work, choose how it is experienced, and publish it with one link." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Editor — Portfolia" },
      { property: "og:description", content: "Arrange your work and choose how it is experienced." },
    ],
  }),
  component: EditorPage,
});

type Tab = "design" | "item" | "about" | "share" | "versions";

function EditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const portfolio = usePortfolio(id);
  const [projectId, setProjectId] = useState<string>("");
  const [selection, setSelection] = useState<Selection>({});
  const [advanced, setAdvanced] = useState(false);
  const [mode, setMode] = useState<"layout" | "page">("layout");
  const [tab, setTab] = useState<Tab>("design");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const { save, failNextSave } = useSaveStatus();
  const { canUndo, canRedo } = useHistoryFlags();

  useEffect(() => {
    if (portfolio && !portfolio.projects.some((p) => p.id === projectId)) {
      setProjectId(portfolio.projects[0]?.id ?? "");
    }
  }, [portfolio, projectId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName))) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const project = useMemo(
    () => portfolio?.projects.find((p) => p.id === projectId) ?? portfolio?.projects[0],
    [portfolio, projectId],
  );

  if (!portfolio) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          This portfolio isn’t in this browser’s storage. Prototype work is stored locally, so it does
          not travel between browsers or devices.
        </p>
        <Button asChild variant="line">
          <Link to="/dashboard">Back to your work</Link>
        </Button>
      </div>
    );
  }
  if (!project) return null;

  const layout = layoutFor(portfolio, project);
  const settings = portfolio.layoutSettings[layout];
  const pageItem = findItem(project, selection.itemId);
  const inPageMode = mode === "page" && isPageItem(pageItem);

  const api = {
    portfolio,
    project,
    projectId: project.id,
    setProjectId,
    selection,
    select: (s: Selection) => setSelection(s),
    advanced,
    setAdvanced,
    mode,
    setMode,
    notify: (message: string, tone: "info" | "error" = "info") => setToast({ message, tone }),
  };

  const saveLabel =
    save === "saving" ? "Saving…" : save === "error" ? "Couldn’t save" : save === "saved" ? "Saved" : "Ready";

  return (
    <EditorContext.Provider value={api}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        {/* ------------------------------------------------------------- top bar */}
        <header className="rule-b flex h-14 shrink-0 items-center gap-3 px-3">
          <Button asChild variant="quiet" size="icon-sm" aria-label="Back to your work">
            <Link to="/dashboard">
              <ArrowLeft />
            </Link>
          </Button>
          <Wordmark className="hidden sm:block" />
          <Input
            value={portfolio.title}
            onChange={(e) =>
              updatePortfolio(portfolio.id, (p) => {
                p.title = e.target.value;
              })
            }
            className="h-8 w-44 border-transparent px-1 text-sm hover:border-input focus-visible:border-input sm:w-64"
            aria-label="Portfolio title"
          />
          <span
            className={cn(
              "text-xxs",
              save === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {saveLabel}
          </span>
          {save === "error" && (
            <Button size="xs" variant="line" onClick={retrySave}>
              <RefreshCw /> Retry
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="quiet" size="icon-sm" aria-label="Undo" disabled={!canUndo} onClick={undo}>
              <Undo2 />
            </Button>
            <Button variant="quiet" size="icon-sm" aria-label="Redo" disabled={!canRedo} onClick={redo}>
              <Redo2 />
            </Button>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <div className="hidden items-center border border-border sm:flex">
              <button
                type="button"
                aria-label="Desktop preview"
                onClick={() => setDevice("desktop")}
                className={cn("px-2 py-1", device === "desktop" && "bg-accent")}
              >
                <Monitor className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Mobile preview"
                onClick={() => setDevice("mobile")}
                className={cn("px-2 py-1", device === "mobile" && "bg-accent")}
              >
                <Smartphone className="size-3.5" />
              </button>
            </div>
            <label className="hidden items-center gap-1.5 text-xxs text-muted-foreground sm:flex">
              <input
                type="checkbox"
                checked={advanced}
                onChange={(e) => setAdvanced(e.target.checked)}
                className="size-3.5 accent-foreground"
              />
              Advanced controls
            </label>
            <Button asChild size="xs" variant="line">
              <Link
                to="/p/$slug"
                params={{ slug: portfolio.slug }}
                search={{ preview: "draft" }}
                target="_blank"
              >
                <Eye /> Preview
              </Link>
            </Button>
            <Button size="xs" onClick={() => setTab("share")}>
              Share
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* ------------------------------------------------------- left panel */}
          <aside className="hidden w-72 shrink-0 border-r border-border lg:block">
            <ContentPanel />
          </aside>

          {/* ------------------------------------------------------------ canvas */}
          <main className="flex min-w-0 flex-1 flex-col bg-canvas">
            {inPageMode ? (
              <>
                <div className="rule-b flex items-center gap-2 bg-background px-4 py-2">
                  <Button size="xs" variant="quiet" onClick={() => setMode("layout")}>
                    <ArrowLeft /> Back to the whole project
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <PageCanvas item={pageItem as never} />
                </div>
              </>
            ) : (
              <>
                <div className="rule-b flex flex-wrap items-center gap-2 bg-background px-4 py-2">
                  <span className="text-xxs text-muted-foreground">
                    {project.title} · live preview in the chosen viewing style · click an item to select
                    it, click text to edit it
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-6">
                  <div
                    className={cn(
                      "mx-auto bg-background transition-all",
                      device === "mobile" ? "w-[390px] hairline" : "w-full max-w-5xl hairline",
                    )}
                    style={{ background: portfolio.theme.background }}
                  >
                    <Presentation
                      layout={layout}
                      items={project.items}
                      compact={device === "mobile"}
                      ctx={{
                        theme: portfolio.theme,
                        settings,
                        editing: true,
                        selectedItemId: selection.itemId,
                        onSelect: (itemId) => {
                          setSelection({ itemId });
                          setTab("item");
                        },
                        onEditText: (itemId, text) =>
                          patchItem(portfolio.id, project.id, itemId, (i) => {
                            if (i.kind === "text") i.text = text;
                          }),
                        onOpen: (t) => setViewer(t),
                      }}
                    />
                  </div>
                  {device === "mobile" && (
                    <p className="mx-auto mt-4 max-w-md text-center text-xxs leading-relaxed text-muted-foreground">
                      On narrow screens, complete page compositions scale down proportionally so nothing
                      is rearranged, while standalone images and text reflow into a single column.
                      Detailed canvas editing — free positioning, rotation, layers — is desktop only.
                    </p>
                  )}
                </div>
              </>
            )}
          </main>

          {/* ------------------------------------------------------ right panel */}
          <aside className="hidden w-80 shrink-0 flex-col border-l border-border xl:flex">
            <div className="rule-b flex shrink-0 overflow-x-auto">
              {(
                [
                  ["design", "Design"],
                  ["item", "Selected"],
                  ["about", "About"],
                  ["share", "Share"],
                  ["versions", "History"],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "px-3 py-2.5 text-xs whitespace-nowrap",
                    tab === key ? "border-b border-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "design" && <InspectorDesign />}
              {tab === "item" && <InspectorItem />}
              {tab === "about" && <AboutPanel />}
              {tab === "share" && (
                <div className="p-4">
                  <SharePanel portfolio={portfolio} />
                </div>
              )}
              {tab === "versions" && <VersionsPanel />}
            </div>
          </aside>
        </div>

        {/* ------------------------------------------------- small-screen notes */}
        <div className="rule-t flex items-center gap-3 px-4 py-2 lg:hidden">
          <p className="text-xxs text-muted-foreground">
            On a small screen you can upload, edit text and image details, reorder and preview. Detailed
            canvas editing needs a larger screen.
          </p>
          <Button
            size="xs"
            variant="line"
            className="ml-auto shrink-0"
            onClick={() => navigate({ to: "/dashboard" })}
          >
            Your work
          </Button>
        </div>

        {toast && (
          <div
            role="status"
            className={cn(
              "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border bg-background px-4 py-2.5 text-xs",
              toast.tone === "error" ? "border-destructive text-destructive" : "border-foreground",
            )}
          >
            {toast.message}
          </div>
        )}

        {failNextSave && (
          <div className="fixed bottom-4 right-4 z-40 border border-border bg-background px-3 py-2 text-xxs text-muted-foreground">
            Save-failure demo is armed: the next save will fail so you can try Retry.
          </div>
        )}
      </div>

      {viewer && <ImageViewer target={viewer} onClose={() => setViewer(null)} />}
    </EditorContext.Provider>
  );
}
