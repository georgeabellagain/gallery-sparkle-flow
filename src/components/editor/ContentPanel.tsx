import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  FileUp,
  ImagePlus,
  Lock,
  Plus,
  SquarePen,
  Trash2,
  Type,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AssetImage } from "@/components/portfolia/AssetImage";
import { patchItem, useEditor, isPageItem } from "./editorContext";
import {
  addProject,
  moveItem,
  trashItem,
  trashProject,
  updatePortfolio,
  updateProject,
} from "@/lib/portfolia/store";
import { uploadImages } from "@/lib/portfolia/uploads";
import { importPdfIntoPortfolio } from "@/lib/portfolia/importFlow";
import { uid } from "@/lib/portfolia/assets";
import { itemLabel, type Item } from "@/lib/portfolia/types";
import { cn } from "@/lib/utils";

export function ContentPanel() {
  const { portfolio, project, projectId, setProjectId, selection, select, setMode, notify } =
    useEditor();
  const imageInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ phase: string; percent: number } | null>(null);

  const addText = () => {
    const id = uid("it");
    updateProject(portfolio.id, projectId, (pr) => {
      pr.items.push({ id, kind: "text", text: "Click to edit this text", style: { size: 18 } });
    });
    select({ itemId: id });
  };

  const addBlankPage = () => {
    const id = uid("it");
    updateProject(portfolio.id, projectId, (pr) => {
      pr.items.push({
        id,
        kind: "composition",
        aspect: 0.7071,
        background: "#ffffff",
        label: "New page",
        elements: [],
        hotspots: [],
      });
    });
    select({ itemId: id });
    setMode("page");
  };

  const onImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy({ phase: "Uploading images", percent: 5 });
    const report = await uploadImages(Array.from(files), {
      portfolioId: portfolio.id,
      projectId,
      onProgress: ({ done, total, name }) =>
        setBusy({
          phase: name ? `Adding ${name}` : "Finishing",
          percent: Math.round((done / Math.max(1, total)) * 100),
        }),
    });
    setBusy(null);
    if (report.failures.length) {
      notify(
        `${report.added} added. ${report.failures.length} failed: ${report.failures
          .map((f) => `${f.name} (${f.reason})`)
          .join(", ")}. Everything else was kept.`,
        "error",
      );
    } else {
      notify(`${report.added} image${report.added === 1 ? "" : "s"} added.`);
    }
  };

  const onPdf = async (file?: File | null) => {
    if (!file) return;
    setBusy({ phase: "Reading PDF", percent: 2 });
    try {
      const { pages } = await importPdfIntoPortfolio(file, {
        portfolioId: portfolio.id,
        projectId,
        onProgress: (i) => setBusy({ phase: i.phase, percent: i.percent }),
      });
      notify(`${pages} page${pages === 1 ? "" : "s"} imported as intact pages.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "The PDF could not be imported.", "error");
    } finally {
      setBusy(null);
    }
  };

  const duplicate = (item: Item, index: number) => {
    const copy = JSON.parse(JSON.stringify(item)) as Item;
    copy.id = uid("it");
    if ("elements" in copy) copy.elements = copy.elements.map((e) => ({ ...e, id: uid("el") }));
    updateProject(portfolio.id, projectId, (pr) => pr.items.splice(index + 1, 0, copy));
    select({ itemId: copy.id });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="rule-b px-3 py-3">
        <div className="flex items-center justify-between">
          <h2 className="label-xs">Projects</h2>
          <Button
            size="icon-sm"
            variant="quiet"
            aria-label="Add project"
            onClick={() => {
              const id = addProject(portfolio.id);
              setProjectId(id);
            }}
          >
            <Plus />
          </Button>
        </div>
        <ul className="mt-2 space-y-0.5">
          {portfolio.projects.map((pr) => (
            <li key={pr.id}>
              <button
                type="button"
                onClick={() => {
                  setProjectId(pr.id);
                  select({});
                  setMode("layout");
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  pr.id === projectId ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <span className="truncate">{pr.title}</span>
                <span className="shrink-0 text-xxs text-muted-foreground">{pr.items.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rule-b space-y-2 px-3 py-3">
        <Input
          value={project.title}
          onChange={(e) =>
            updateProject(portfolio.id, projectId, (pr) => {
              pr.title = e.target.value;
            })
          }
          className="h-8 text-sm"
          aria-label="Project title"
        />
        <Input
          value={project.description ?? ""}
          onChange={(e) =>
            updateProject(portfolio.id, projectId, (pr) => {
              pr.description = e.target.value;
            })
          }
          placeholder="Short description (optional)"
          className="h-8 text-xs"
          aria-label="Project description"
        />
        {portfolio.projects.length > 1 && (
          <Button
            size="xs"
            variant="quiet"
            onClick={() => {
              trashProject(portfolio.id, projectId);
              const next = portfolio.projects.find((p) => p.id !== projectId);
              if (next) setProjectId(next.id);
              notify("Project moved to the trash. You can restore it.");
            }}
          >
            <Trash2 /> Delete project
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 rule-b px-3 py-2.5">
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onImages(e.target.files)}
        />
        <input
          ref={pdfInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => void onPdf(e.target.files?.[0])}
        />
        <Button size="xs" variant="line" onClick={() => imageInput.current?.click()}>
          <ImagePlus /> Images
        </Button>
        <Button size="xs" variant="line" onClick={addText}>
          <Type /> Text
        </Button>
        <Button size="xs" variant="line" onClick={addBlankPage}>
          <FilePlus2 /> Page
        </Button>
        <Button size="xs" variant="line" onClick={() => pdfInput.current?.click()}>
          <FileUp /> PDF
        </Button>
      </div>

      {busy && (
        <div className="rule-b px-3 py-2.5">
          <p className="text-xs">{busy.phase}</p>
          <Progress value={busy.percent} className="mt-1.5 h-1" />
          <p className="mt-1.5 text-xxs text-muted-foreground">
            The editor stays usable while this runs.
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <h2 className="label-xs">Content · {project.items.length}</h2>
        {!project.items.length && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Empty project. Add images, text, a blank page, or import a PDF.
          </p>
        )}
        <ul className="mt-2 space-y-1">
          {project.items.map((item, index) => {
            const active = selection.itemId === item.id;
            return (
              <li
                key={item.id}
                className={cn(
                  "group rounded-sm border p-1.5",
                  active ? "border-foreground" : "border-transparent hover:border-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => {
                      select({ itemId: item.id });
                      setMode(isPageItem(item) ? "page" : "layout");
                    }}
                  >
                    <span className="h-9 w-9 shrink-0 overflow-hidden bg-muted">
                      {item.kind === "text" ? (
                        <span className="flex h-full w-full items-center justify-center text-xxs text-muted-foreground">
                          Aa
                        </span>
                      ) : (
                        <AssetImage
                          assetId={
                            item.kind === "image"
                              ? item.assetId
                              : item.assetId ?? item.elements.find((e) => e.assetId)?.assetId
                          }
                          alt=""
                          className="h-full w-full"
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs">{itemLabel(item)}</span>
                      <span className="block text-xxs text-muted-foreground">
                        {item.kind === "pdfPage"
                          ? "Imported PDF page"
                          : item.kind === "composition"
                            ? "Designed page"
                            : item.kind === "image"
                              ? "Image"
                              : "Text"}
                        {item.hidden ? " · hidden" : ""}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <IconBtn
                      label="Move up"
                      disabled={index === 0}
                      onClick={() => moveItem(portfolio.id, projectId, index, index - 1)}
                    >
                      <ArrowUp />
                    </IconBtn>
                    <IconBtn
                      label="Move down"
                      disabled={index === project.items.length - 1}
                      onClick={() => moveItem(portfolio.id, projectId, index, index + 1)}
                    >
                      <ArrowDown />
                    </IconBtn>
                    <IconBtn
                      label={item.hidden ? "Show" : "Hide"}
                      onClick={() =>
                        patchItem(portfolio.id, projectId, item.id, (i) => {
                          i.hidden = !i.hidden;
                        })
                      }
                    >
                      {item.hidden ? <EyeOff /> : <Eye />}
                    </IconBtn>
                    <IconBtn
                      label={item.locked ? "Unlock" : "Lock"}
                      onClick={() =>
                        patchItem(portfolio.id, projectId, item.id, (i) => {
                          i.locked = !i.locked;
                        })
                      }
                    >
                      {item.locked ? <Lock /> : <Unlock />}
                    </IconBtn>
                    {isPageItem(item) && (
                      <IconBtn
                        label="Edit page"
                        onClick={() => {
                          select({ itemId: item.id });
                          setMode("page");
                        }}
                      >
                        <SquarePen />
                      </IconBtn>
                    )}
                    <IconBtn label="Duplicate" onClick={() => duplicate(item, index)}>
                      <Copy />
                    </IconBtn>
                    <IconBtn
                      label="Delete"
                      onClick={() => {
                        trashItem(portfolio.id, projectId, item.id);
                        if (selection.itemId === item.id) select({});
                        notify("Moved to the trash. Restore it from Versions & trash.");
                      }}
                    >
                      <Trash2 />
                    </IconBtn>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 rule-t pt-3">
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={portfolio.singleProjectDirect}
              onChange={(e) =>
                updatePortfolio(portfolio.id, (p) => {
                  p.singleProjectDirect = e.target.checked;
                })
              }
            />
            <span>
              With one project, open the shared link straight into the work instead of a cover page.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button variant="quiet" size="icon-sm" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
