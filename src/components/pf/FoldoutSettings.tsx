import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteBlob, putBlob, uid } from "@/lib/portfolia/assets";
import { getDoc, patchPortfolio, type Portfolio } from "@/lib/portfolia/store";
import {
  fitFoldout,
  foldoutKeys,
  foldoutSurfaces,
  foldoutsForLeaf,
  MAX_FOLDOUTS,
  NOTE_TEXT_LIMIT,
  readableFoldouts,
  transformFoldout,
  validateFoldout,
  type Foldout,
  type FoldoutSurface,
  type ResizeCorner,
} from "@/lib/portfolia/foldouts";
import {
  NOTE_FONT_FAMILIES,
  loadNoteFonts,
} from "@/lib/portfolia/foldout-paint";
import {
  LINK_SIZE,
  MAX_LINKS,
  MAX_TAGS,
  TAG_COLOURS,
  TAG_LABEL_LIMIT,
  linkName,
  linksForLeaf,
  normaliseUrl,
  placeLink,
  readablePageLinks,
  readablePageTags,
  validatePageLink,
  validatePageTag,
  type PageLink,
  type PageTag,
} from "@/lib/portfolia/page-extras";
import { LinkLogo } from "./PageLinks";
import { prepareFoldoutImage } from "@/lib/portfolia/foldout-image";
import {
  coverWithSpreads,
  coverThenSpreads,
} from "@/lib/portfolia/mixed-layout";
import { bookLayout, type Leaf } from "@/lib/portfolia/book-layout";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { FoldoutCard, NoteSurface } from "./FoldoutCard";
import { useBlob } from "./Chrome";

export function FoldoutSettings({ p }: { p: Portfolio }) {
  const [open, setOpen] = useState(false);
  const count = readableFoldouts(p.pdf?.foldouts, p.pdf?.pages ?? 0).length;
  return (
    <section className="mt-6 rule-t pt-5" aria-label="Scrapbook fold-outs">
      <h2 className="text-sm font-medium">Scrapbook notes</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Stick a note to any page. Drop in pictures or write text, then drag and
        resize it. The outside and inside each have their own colours, text and
        image.
      </p>
      <Button
        className="mt-3"
        size="sm"
        variant="line"
        onClick={() => setOpen(true)}
      >
        Edit scrapbook{count ? ` · ${count} notes` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex h-[94dvh] w-[96vw] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px]"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (
              (e.target as Element | null)?.closest?.(
                '[data-foldout][data-open="true"]',
              )
            )
              e.preventDefault();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DialogTitle className="px-5 pt-5">Scrapbook editor</DialogTitle>
          <DialogDescription className="px-5 pb-4 pt-2 text-xs">
            Drag notes to move them. Pull a corner to resize. Drop an image on
            the page to add a note.
          </DialogDescription>
          {open && p.pdf && (
            <ScrapbookWorkspace p={p} onClose={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ScrapbookWorkspace({
  p,
  onClose,
}: {
  p: Portfolio;
  onClose: () => void;
}) {
  const pdf = p.pdf!;
  const blob = useBlob(pdf.blobKey);
  const [items, setItems] = useState(() =>
    readableFoldouts(pdf.foldouts, pdf.pages),
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [tags, setTags] = useState(() => readablePageTags(pdf.tags, pdf.pages));
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const [links, setLinks] = useState(() => readablePageLinks(pdf.links, pdf.pages));
  const linksRef = useRef(links);
  linksRef.current = links;
  const [panel, setPanel] = useState<"notes" | "tabs" | "links">("notes");
  const [selectedLink, setSelectedLink] = useState<string | null>(links[0]?.id ?? null);
  const iconInput = useRef<HTMLInputElement>(null);
  const iconTarget = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null);
  const [side, setSide] = useState<"outside" | "inside">("outside");
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const live = useRef(true);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [ratio, setRatio] = useState(1.4);
  const [index, setIndex] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [dropActive, setDropActive] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{
    id: string;
    side: "outside" | "inside";
  } | null>(null);
  const staged = useRef(new Set<string>());
  const leaf = leaves[index];
  const note = items.find((f) => f.id === selected);
  useEffect(() => {
    if (note?.hinge === "none") setSide("outside");
  }, [note?.id, note?.hinge]);
  const visible = leaf ? foldoutsForLeaf(items, leaf) : [];
  const change = (next: Foldout[]) => {
    itemsRef.current = next;
    setItems(next);
    setDirty(true);
    setError("");
  };
  const changeTags = (next: PageTag[]) => {
    tagsRef.current = next;
    setTags(next);
    setDirty(true);
    setError("");
  };
  const changeLinks = (next: PageLink[]) => {
    linksRef.current = next;
    setLinks(next);
    setDirty(true);
    setError("");
  };
  const editLink = (id: string, patch: Partial<PageLink>) =>
    changeLinks(linksRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const editTag = (id: string, patch: Partial<PageTag>) =>
    changeTags(tagsRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const addTag = () => {
    if (!leaf) return;
    if (tagsRef.current.length >= MAX_TAGS) return setError(`Use up to ${MAX_TAGS} tabs.`);
    changeTags([
      ...tagsRef.current,
      { id: uid("tab"), page: leaf.page, label: "", colour: TAG_COLOURS[tagsRef.current.length % TAG_COLOURS.length]! },
    ]);
    setPanel("tabs");
  };
  const addLink = () => {
    if (!leaf) return;
    if (linksRef.current.length >= MAX_LINKS) return setError(`Use up to ${MAX_LINKS} links.`);
    const link: PageLink = {
      id: uid("link"),
      page: leaf.page,
      half: leaf.half ?? "right",
      url: "",
      x: 0.5 - LINK_SIZE.default / 2,
      y: 0.4,
      size: LINK_SIZE.default,
    };
    changeLinks([...linksRef.current, link]);
    setSelectedLink(link.id);
    setPanel("links");
    setPreview(false);
  };
  const uploadIcon = async (file: File | undefined, id: string | null) => {
    if (!file || !id || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      assertCurrent();
      const prepared = await prepareFoldoutImage(file);
      if (!live.current) return;
      const key = uid("foldout");
      await putBlob(key, prepared);
      if (!live.current) {
        await deleteBlob(key).catch(() => {});
        return;
      }
      staged.current.add(key);
      editLink(id, { iconKey: key });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      if (live.current) setBusy(false);
    }
  };
  const edit = (id: string, patch: Partial<Foldout>) =>
    change(
      itemsRef.current.map((f) =>
        f.id === id ? fitFoldout({ ...f, ...patch }) : f,
      ),
    );
  const assertCurrent = () => {
    const current = getDoc().portfolio;
    if (current?.code !== p.code || current.pdf?.blobKey !== pdf.blobKey)
      throw new Error(
        "The PDF changed. Close this editor and reopen the correct portfolio.",
      );
    return current.pdf;
  };
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      staged.current.forEach((key) => void deleteBlob(key).catch(() => {}));
    };
  }, []);
  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    let task:
      | ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>
      | undefined;
    void (async () => {
      try {
        const api = await loadPdfjs();
        if (cancelled) return;
        task = api.getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
        });
        opened = await task.promise;
        if (cancelled) {
          await opened.destroy();
          return;
        }
        const sizes = [];
        for (let i = 1; i <= opened.numPages; i++) {
          const v = (await opened.getPage(i)).getViewport({ scale: 1 });
          sizes.push({ w: v.width, h: v.height });
        }
        if (cancelled) return;
        const mixed = coverWithSpreads(sizes);
        const layout = mixed
          ? coverThenSpreads(opened.numPages)
          : bookLayout(opened.numPages, p.viewer?.spreads === "ready");
        const first = sizes[mixed ? 1 : 0]!;
        setRatio(
          first.h /
            (mixed || p.viewer?.spreads === "ready" ? first.w / 2 : first.w),
        );
        setLeaves(layout.leaves);
        setPdfDoc(opened);
        const initial = itemsRef.current.find((f) => f.id === selected);
        setIndex(
          Math.max(
            0,
            layout.leaves.findIndex(
              (l) =>
                l.page === (initial?.page ?? 1) &&
                (!l.half || l.half === initial?.half),
            ),
          ),
        );
      } catch {
        if (!cancelled)
          setPageError(
            "Could not load this PDF for placement. Close and reopen the editor.",
          );
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [blob, p.viewer?.spreads]);
  useEffect(() => {
    if (!pdfDoc || !leaf || !canvas.current) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    setRendering(true);
    setPageError("");
    void (async () => {
      try {
        const pdfPage = await pdfDoc.getPage(leaf.page);
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({
          scale: 1400 / Math.max(base.width, base.height),
        });
        const raw = document.createElement("canvas");
        raw.width = Math.ceil(viewport.width);
        raw.height = Math.ceil(viewport.height);
        task = pdfPage.render({
          canvasContext: raw.getContext("2d")!,
          viewport,
        });
        await task.promise;
        if (cancelled) return;
        const output = canvas.current!;
        output.width = 1000;
        output.height = Math.round(1000 * ratio);
        const ctx = output.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, output.width, output.height);
        const sw = leaf.half ? raw.width / 2 : raw.width,
          sx = leaf.half === "right" ? raw.width / 2 : 0;
        const scale = Math.min(output.width / sw, output.height / raw.height);
        const w = sw * scale,
          h = raw.height * scale;
        ctx.drawImage(
          raw,
          sx,
          0,
          sw,
          raw.height,
          (output.width - w) / 2,
          (output.height - h) / 2,
          w,
          h,
        );
        raw.width = raw.height = 0;
        setRendering(false);
      } catch {
        if (!cancelled) {
          setPageError("This page could not be prepared. Try another page.");
          setRendering(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdfDoc, leaf, ratio]);
  const add = (imageKey?: string, point?: { x: number; y: number }) => {
    if (!leaf) throw new Error("Wait for the PDF page to load.");
    if (itemsRef.current.length >= MAX_FOLDOUTS)
      throw new Error(`Use up to ${MAX_FOLDOUTS} notes per PDF.`);
    const f: Foldout = fitFoldout({
      id: uid("note"),
      page: leaf.page,
      half: leaf.half ?? "right",
      title: imageKey ? "Image note" : "Text note",
      colour: "#e5dcc6",
      hinge: point && point.x < 0.5 ? "right" : "left",
      x: point ? point.x - 0.16 : 0.5,
      y: point ? point.y - 0.17 : 0.3,
      width: 0.32,
      height: 0.34,
      outside: { colour: "#e5dcc6", text: "Open note" },
      inside: {
        colour: "#fbf6e9",
        text: imageKey ? "" : "Write your note here…",
        ...(imageKey ? { imageKey } : {}),
      },
    });
    change([...itemsRef.current, f]);
    setSelected(f.id);
    setIndex(
      Math.max(
        0,
        leaves.findIndex(
          (l) => l.page === f.page && (!l.half || l.half === f.half),
        ),
      ),
    );
    setSide("inside");
    setPreview(false);
  };
  const upload = async (
    file?: File,
    target?: { id: string; side: "outside" | "inside" } | null,
    point?: { x: number; y: number },
  ) => {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    let key: string | undefined;
    try {
      assertCurrent();
      if (!target && itemsRef.current.length >= MAX_FOLDOUTS)
        throw new Error(`Use up to ${MAX_FOLDOUTS} notes per PDF.`);
      const prepared = await prepareFoldoutImage(file);
      if (!live.current) return;
      assertCurrent();
      key = uid("foldout");
      await putBlob(key, prepared);
      if (!live.current) {
        await deleteBlob(key).catch(() => {});
        return;
      }
      staged.current.add(key);
      assertCurrent();
      if (target) {
        const existing = itemsRef.current.find((f) => f.id === target.id);
        if (!existing)
          throw new Error(
            "That note was removed. Drop the image onto the page to add a new one.",
          );
        const surfaces = foldoutSurfaces(existing);
        edit(existing.id, {
          [target.side]: { ...surfaces[target.side], imageKey: key },
        });
      } else add(key, point);
    } catch (e) {
      setError((e as Error).message);
      if (
        key &&
        staged.current.has(key) &&
        !foldoutKeys({ pages: pdf.pages, foldouts: itemsRef.current, links: linksRef.current }).includes(
          key,
        )
      ) {
        staged.current.delete(key);
        void deleteBlob(key).catch(() => {});
      }
    } finally {
      busyRef.current = false;
      if (live.current) setBusy(false);
    }
  };
  const save = () => {
    try {
      const current = assertCurrent();
      for (const f of itemsRef.current) {
        const invalid = validateFoldout(f, current.pages);
        if (invalid) throw new Error(invalid);
      }
      const savedLinks = linksRef.current.map((l) => ({
        ...l,
        url: normaliseUrl(l.url) ?? l.url,
        label: l.label?.trim() || undefined,
      }));
      for (const l of savedLinks) {
        if (!l.url.trim()) throw new Error("Add a web address to each link, or remove the empty one.");
        const invalid = validatePageLink(l, current.pages);
        if (invalid) throw new Error(`${linkName(l) || "A link"}: ${invalid}`);
      }
      const savedTags = tagsRef.current.map((t) => ({ ...t, label: t.label.trim() }));
      for (const t of savedTags) {
        const invalid = validatePageTag(t, current.pages);
        if (invalid) throw new Error(invalid);
      }
      if (
        !patchPortfolio({
          pdf: {
            ...current,
            foldouts: itemsRef.current,
            tags: savedTags.length ? savedTags : undefined,
            links: savedLinks.length ? savedLinks : undefined,
          },
        })
      )
        throw new Error(
          "Could not save these notes. Free some browser storage and retry.",
        );
      const keep = new Set(
        foldoutKeys({ pages: pdf.pages, foldouts: itemsRef.current, links: savedLinks }),
      );
      const remove = new Set([...foldoutKeys(current), ...staged.current]);
      staged.current.clear();
      for (const key of remove)
        if (!keep.has(key)) void deleteBlob(key).catch(() => {});
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    start: Foldout;
    handle: "move" | ResizeCorner;
    width: number;
    height: number;
  } | null>(null);
  const begin = (
    e: PointerEvent<HTMLElement>,
    f: Foldout,
    handle: "move" | ResizeCorner,
  ) => {
    if (
      preview ||
      !e.isPrimary ||
      (e.pointerType === "mouse" && e.button !== 0)
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(f.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = page.current!.getBoundingClientRect();
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: f,
      handle,
      width: rect.width,
      height: rect.height,
    };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const next = transformFoldout(
      g.start,
      (e.clientX - g.x) / g.width,
      (e.clientY - g.y) / g.height,
      g.handle,
    );
    change(itemsRef.current.map((f) => (f.id === next.id ? next : f)));
  };
  const end = (e: PointerEvent<HTMLElement>) => {
    if (gesture.current?.id === e.pointerId) {
      gesture.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const choosePage = (i: number, keepSelected: string | null = null) => {
    setSelected(keepSelected);
    setIndex(i);
    setPreview(false);
    gesture.current = null;
  };
  const pickImage = (target?: { id: string; side: "outside" | "inside" }) => {
    uploadTarget.current = target ?? null;
    fileInput.current?.click();
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-y px-5 py-3">
        <Button
          size="sm"
          variant="line"
          disabled={!leaf || busy || items.length >= MAX_FOLDOUTS}
          onClick={() => {
            try {
              add();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          + Text note
        </Button>
        <Button
          size="sm"
          variant="line"
          disabled={!leaf || busy || items.length >= MAX_FOLDOUTS}
          onClick={() => pickImage()}
        >
          + Image note
        </Button>
        <Button size="sm" variant="line" disabled={!leaf || busy} onClick={addLink}>
          + Website link
        </Button>
        <Button size="sm" variant="line" disabled={!leaf || busy} onClick={addTag}>
          + Page tab
        </Button>
        <Button
          size="sm"
          variant={preview ? "default" : "line"}
          disabled={!leaf}
          onClick={() => setPreview((v) => !v)}
        >
          {preview ? "Back to editing" : "Try opening notes"}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {busy
            ? "Preparing image…"
            : dirty
              ? "Unsaved changes"
              : `${items.length} / ${MAX_FOLDOUTS} notes`}
        </span>
        <Button size="sm" variant="quiet" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy || !dirty} onClick={save}>
          Save changes
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Note image"
        onChange={(e) => {
          void upload(e.target.files?.[0], uploadTarget.current);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={iconInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Link logo"
        onChange={(e) => {
          void uploadIcon(e.target.files?.[0], iconTarget.current);
          e.currentTarget.value = "";
        }}
      />
      {error && (
        <p role="alert" className="px-5 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-[minmax(0,1fr)_300px]">
        <section
          className="min-w-0 overflow-auto bg-muted/60 p-4 sm:p-6"
          aria-label="Page placement"
        >
          <div className="mb-4 flex items-center justify-center gap-3 text-xs">
            <Button
              size="sm"
              variant="quiet"
              disabled={index === 0 || !leaf}
              onClick={() => choosePage(index - 1)}
            >
              Previous
            </Button>
            <label>
              Page{" "}
              <select
                aria-label="PDF page or spread half"
                value={index}
                onChange={(e) => choosePage(Number(e.target.value))}
                className="ml-2 rounded border bg-background p-2"
              >
                {leaves.map((l, i) => (
                  <option key={i} value={i}>
                    {l.page}
                    {l.half ? ` · ${l.half} half` : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              variant="quiet"
              disabled={index >= leaves.length - 1 || !leaf}
              onClick={() => choosePage(index + 1)}
            >
              Next
            </Button>
          </div>
          {pageError && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {pageError}
            </p>
          )}
          {!leaf && (
            <p role="status" className="py-10 text-center text-sm">
              Preparing PDF…
            </p>
          )}
          <div
            ref={page}
            className={`relative mx-auto w-full bg-white shadow-sm ${dropActive ? "ring-4 ring-leaf" : ""}`}
            style={{
              maxWidth: 650,
              aspectRatio: `1 / ${ratio}`,
              visibility: !leaf ? "hidden" : "visible",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDropActive(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDropActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              if (rendering || preview) return;
              const rect = e.currentTarget.getBoundingClientRect();
              void upload(e.dataTransfer.files[0], null, {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height,
              });
            }}
          >
            <canvas
              ref={canvas}
              className={`block h-full w-full ${rendering ? "invisible" : ""}`}
            />
            {rendering && leaf && (
              <p
                role="status"
                className="absolute inset-x-0 top-1/2 text-center text-sm"
              >
                Preparing page…
              </p>
            )}
            {!rendering &&
              visible.map((f) =>
                preview ? (
                  <FoldoutCard key={`${f.id}:preview`} item={f} />
                ) : (
                  <div
                    key={f.id}
                    className={`absolute touch-none ${f.id === selected ? "pf-note-selected z-10" : ""}`}
                    style={{
                      left: `${f.x * 100}%`,
                      top: `${f.y * 100}%`,
                      width: `${f.width * 100}%`,
                      height: `${f.height * 100}%`,
                    }}
                  >
                    <button
                      type="button"
                      className="block h-full w-full cursor-move touch-none"
                      aria-label={`Move note: ${f.title}`}
                      aria-pressed={selected === f.id}
                      onFocus={() => setSelected(f.id)}
                      onPointerDown={(e) => begin(e, f, "move")}
                      onPointerMove={move}
                      onPointerUp={end}
                      onPointerCancel={end}
                      onKeyDown={(e) => {
                        const delta = e.shiftKey ? 0.02 : 0.005;
                        const vectors: Record<string, [number, number]> = {
                          ArrowLeft: [-delta, 0],
                          ArrowRight: [delta, 0],
                          ArrowUp: [0, -delta],
                          ArrowDown: [0, delta],
                        };
                        const v = vectors[e.key];
                        if (v) {
                          e.preventDefault();
                          e.stopPropagation();
                          const next = transformFoldout(f, ...v, "move");
                          edit(f.id, next);
                        }
                      }}
                    >
                      <NoteSurface
                        side={foldoutSurfaces(f).outside}
                        label={f.title}
                      />
                    </button>
                    {f.id === selected &&
                      (["nw", "ne", "sw", "se"] as const).map((c) => (
                        <button
                          type="button"
                          key={c}
                          aria-label={`Resize ${c} corner of ${f.title}`}
                          className="pf-note-handle"
                          style={{
                            left: c.includes("w") ? -10 : undefined,
                            right: c.includes("e") ? -10 : undefined,
                            top: c.includes("n") ? -10 : undefined,
                            bottom: c.includes("s") ? -10 : undefined,
                            cursor: `${c}-resize`,
                          }}
                          onPointerDown={(e) => begin(e, f, c)}
                          onPointerMove={move}
                          onPointerUp={end}
                          onPointerCancel={end}
                          onKeyDown={(e) => {
                            const d = e.shiftKey ? 0.02 : 0.005;
                            const vector: Record<string, [number, number]> = {
                              ArrowLeft: [-d, 0],
                              ArrowRight: [d, 0],
                              ArrowUp: [0, -d],
                              ArrowDown: [0, d],
                            };
                            const v = vector[e.key];
                            if (v) {
                              e.preventDefault();
                              e.stopPropagation();
                              edit(f.id, transformFoldout(f, v[0], v[1], c));
                            }
                          }}
                        />
                      ))}
                  </div>
                ),
              )}
            {!rendering &&
              leaf &&
              linksForLeaf(links, leaf).map((l) => (
                <LinkChip
                  key={l.id}
                  link={l}
                  selected={!preview && l.id === selectedLink && panel === "links"}
                  inert={preview}
                  page={page}
                  onSelect={() => {
                    setSelectedLink(l.id);
                    setPanel("links");
                  }}
                  onMove={(x, y) => editLink(l.id, placeLink(l, x, y))}
                />
              ))}
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-xs text-muted-foreground">
            {preview
              ? "Click a note to unfold it. Escape closes the flap."
              : "Drop a picture anywhere on this page. Select a note or link to move it; use corner handles to resize. Arrow keys nudge; Shift + arrows moves farther."}
          </p>
        </section>
        <aside
          className="border-l bg-background p-4"
          aria-label="Note settings"
        >
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="What to edit">
            {([["notes", `Notes`, items.length], ["tabs", "Tabs", tags.length], ["links", "Links", links.length]] as const).map(([id, name, n]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={panel === id}
                className={`rounded py-2 text-sm ${panel === id ? "bg-background shadow-sm" : ""}`}
                onClick={() => setPanel(id)}
              >
                {name}
                {n ? <span className="ml-1 text-xs text-muted-foreground">{n}</span> : null}
              </button>
            ))}
          </div>
          {panel === "tabs" ? (
            <TagsPanel
              tags={tags}
              leaves={leaves}
              leaf={leaf}
              onAdd={addTag}
              onEdit={editTag}
              onRemove={(id) => changeTags(tagsRef.current.filter((t) => t.id !== id))}
            />
          ) : panel === "links" ? (
            <LinksPanel
              links={links}
              selected={selectedLink}
              leaves={leaves}
              busy={busy}
              onSelect={(id) => {
                setSelectedLink(id);
                const l = linksRef.current.find((x) => x.id === id);
                const i = l ? leaves.findIndex((x) => x.page === l.page && (!x.half || x.half === l.half)) : -1;
                if (i >= 0) choosePage(i, selected);
              }}
              onAdd={addLink}
              onEdit={editLink}
              onMovePage={(id, i) => {
                const target = leaves[i];
                if (target) {
                  editLink(id, { page: target.page, half: target.half ?? "right" });
                  choosePage(i, selected);
                }
              }}
              onLogo={(id) => {
                iconTarget.current = id;
                iconInput.current?.click();
              }}
              onRemove={(id) => {
                changeLinks(linksRef.current.filter((l) => l.id !== id));
                setSelectedLink(null);
              }}
            />
          ) : (
          <>
          <label className="block text-xs">
            Select note
            <select
              className="mt-1 w-full rounded border bg-background p-2 text-sm"
              value={selected ?? ""}
              onChange={(e) => {
                const f = items.find((f) => f.id === e.target.value);
                setSelected(f?.id ?? null);
                if (f) {
                  const i = leaves.findIndex(
                    (l) => l.page === f.page && (!l.half || l.half === f.half),
                  );
                  if (i >= 0) choosePage(i, f.id);
                }
              }}
            >
              <option value="">Choose a note</option>
              {items.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} · page {f.page}
                </option>
              ))}
            </select>
          </label>
          {note ? (
            <>
              <label className="mt-4 block text-xs">
                Note label
                <input
                  className="mt-1 w-full rounded border bg-background p-2 text-sm"
                  maxLength={60}
                  value={note.title}
                  onChange={(e) => edit(note.id, { title: e.target.value })}
                />
              </label>
              <label className="mt-3 block text-xs">
                Attached to page
                <select
                  className="mt-1 w-full rounded border bg-background p-2 text-sm"
                  value={Math.max(
                    0,
                    leaves.findIndex(
                      (l) =>
                        l.page === note.page &&
                        (!l.half || l.half === note.half),
                    ),
                  )}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    const target = leaves[i];
                    if (target) {
                      edit(note.id, {
                        page: target.page,
                        half: target.half ?? "right",
                      });
                      choosePage(i, note.id);
                    }
                  }}
                >
                  {leaves.map((l, i) => (
                    <option key={i} value={i}>
                      {l.page}
                      {l.half ? ` · ${l.half} half` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs">
                Opening direction
                <select
                  className="mt-1 w-full rounded border bg-background p-2 text-sm"
                  value={note.hinge}
                  onChange={(e) => {
                    edit(note.id, {
                      hinge: e.target.value as Foldout["hinge"],
                    });
                    if (e.target.value === "none") setSide("outside");
                  }}
                >
                  <option value="left">Unfold left</option>
                  <option value="right">Unfold right</option>
                  <option value="top">Unfold up</option>
                  <option value="bottom">Unfold down</option>
                  <option value="none">No flap · flat note</option>
                </select>
              </label>
              <div
                className="my-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                role="group"
                aria-label="Edit note surface"
              >
                {(note.hinge === "none"
                  ? (["outside"] as const)
                  : (["outside", "inside"] as const)
                ).map((s) => (
                  <button
                    type="button"
                    key={s}
                    aria-pressed={side === s}
                    className={`rounded py-2 text-sm capitalize ${side === s ? "bg-background shadow-sm" : ""}`}
                    onClick={() => setSide(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <SurfaceControls
                side={foldoutSurfaces(note)[side]}
                name={side}
                busy={busy}
                onChange={(s) => edit(note.id, { [side]: s })}
                onImage={() => pickImage({ id: note.id, side })}
                onDrop={(file) => void upload(file, { id: note.id, side })}
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["width", "height"] as const).map((k) => (
                  <label className="text-xs capitalize" key={k}>
                    {k} (%)
                    <input
                      type="number"
                      className="mt-1 w-full rounded border bg-background p-2"
                      min={8}
                      max={100}
                      value={Math.round(note[k] * 100)}
                      onChange={(e) => {
                        if (Number.isFinite(e.target.valueAsNumber))
                          edit(note.id, { [k]: e.target.valueAsNumber / 100 });
                      }}
                    />
                  </label>
                ))}
              </div>
              <Button
                className="mt-5"
                size="sm"
                variant="quiet"
                onClick={() => {
                  change(itemsRef.current.filter((f) => f.id !== note.id));
                  setSelected(null);
                }}
              >
                Remove note
              </Button>
            </>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Add a text note or drop an image onto the page to begin.
            </p>
          )}
          </>
          )}
          <p className="mt-6 border-t pt-3 text-xs leading-5 text-muted-foreground">
            Changes apply when you save. Notes are web additions; PDF downloads
            stay unchanged. Open panels can extend beyond the page. Images:
            JPEG, PNG or WebP, up to 8 MB.
          </p>
        </aside>
      </div>
    </>
  );
}
function SurfaceControls({
  side,
  name,
  busy,
  onChange,
  onImage,
  onDrop,
}: {
  side: FoldoutSurface;
  name: string;
  busy: boolean;
  onChange: (s: FoldoutSurface) => void;
  onImage: () => void;
  onDrop: (file: File) => void;
}) {
  const imageDrag = useRef<{
    x: number;
    y: number;
    initial: FoldoutSurface;
    width: number;
    height: number;
  } | null>(null);
  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between text-xs">
        {name === "inside" ? "Interior" : "Outside"} colour
        <input
          type="color"
          aria-label={`${name} colour`}
          value={side.colour}
          onChange={(e) => onChange({ ...side, colour: e.target.value })}
        />
      </label>
      <label className="block text-xs">
        {name === "inside" ? "Interior" : "Outside"} text
        <textarea
          className="mt-1 w-full rounded border bg-background p-2 text-sm"
          rows={5}
          maxLength={NOTE_TEXT_LIMIT}
          placeholder="Write here, or leave blank for an image…"
          value={side.text}
          onChange={(e) => onChange({ ...side, text: e.target.value })}
        />
      </label>
      <div
        className="rounded-lg border border-dashed p-3 text-xs"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!busy && e.dataTransfer.files[0]) onDrop(e.dataTransfer.files[0]);
        }}
      >
        <p className="mb-2">Drop a picture for the {name} here.</p>
        <Button size="sm" variant="line" disabled={busy} onClick={onImage}>
          {side.imageKey ? "Replace image" : "Choose image"}
        </Button>
        {side.imageKey && (
          <Button
            className="mt-2"
            size="sm"
            variant="quiet"
            onClick={() => onChange({ ...side, imageKey: undefined })}
          >
            Remove image
          </Button>
        )}
      </div>
      <TextStyleControls side={side} onChange={onChange} />
      {side.imageKey && (
        <div className="space-y-3">
          <label className="block text-xs">
            Image fit
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={side.imageFit ?? "contain"}
              onChange={(e) =>
                onChange({
                  ...side,
                  imageFit: e.target.value as FoldoutSurface["imageFit"],
                })
              }
            >
              <option value="contain">Show entire image</option>
              <option value="cover">Fill and crop</option>
            </select>
          </label>
          {(
            [
              ["imageScale", "Image scale", 0.25, 4, 1],
              ["imageX", "Horizontal position", -1, 1, 0],
              ["imageY", "Vertical position", -1, 1, 0],
            ] as const
          ).map(([key, label, min, max, fallback]) => (
            <label key={key} className="block text-xs">
              {label}
              <input
                className="mt-1 w-full"
                type="range"
                min={min}
                max={max}
                step=".01"
                value={side[key] ?? fallback}
                onChange={(e) =>
                  onChange({ ...side, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          <button
            type="button"
            className="text-xs underline"
            onClick={() =>
              onChange({ ...side, imageScale: 1, imageX: 0, imageY: 0 })
            }
          >
            Reset image placement
          </button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {side.imageKey
          ? "Drag the image below to reposition it. The sliders also allow precise placement."
          : "Artwork preview"}
      </p>
      <div
        className="aspect-[2/1] overflow-hidden rounded border"
        style={{
          touchAction: "none",
          cursor: side.imageKey ? "move" : undefined,
        }}
        onPointerDown={(e) => {
          if (!side.imageKey || e.button !== 0) return;
          const r = e.currentTarget.getBoundingClientRect();
          imageDrag.current = {
            x: e.clientX,
            y: e.clientY,
            initial: side,
            width: r.width,
            height: r.height,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = imageDrag.current;
          if (!d) return;
          onChange({
            ...d.initial,
            imageX: Math.max(
              -1,
              Math.min(
                1,
                (d.initial.imageX ?? 0) + (e.clientX - d.x) / d.width,
              ),
            ),
            imageY: Math.max(
              -1,
              Math.min(
                1,
                (d.initial.imageY ?? 0) + (e.clientY - d.y) / d.height,
              ),
            ),
          });
        }}
        onPointerUp={() => {
          imageDrag.current = null;
        }}
        onPointerCancel={() => {
          imageDrag.current = null;
        }}
      >
        <NoteSurface side={side} label={`${name} artwork preview`} />
      </div>
    </div>
  );
}

const FONT_CHOICES: Array<[NonNullable<FoldoutSurface["font"]>, string]> = [
  ["serif", "Editorial"],
  ["sans", "Clean"],
  ["mono", "Typewriter"],
  ["hand", "Handwritten"],
  ["neat", "Neat pen"],
  ["script", "Script"],
  ["marker", "Marker"],
];
const ALIGN_CHOICES = [
  ["left", "Align left", AlignLeft],
  ["center", "Centre", AlignCenter],
  ["right", "Align right", AlignRight],
  ["justify", "Justify", AlignJustify],
] as const;

/** Fonts are shown as themselves, so choosing one is a look rather than a guess; alignment is one tap. */
function TextStyleControls({
  side,
  onChange,
}: {
  side: FoldoutSurface;
  onChange: (next: FoldoutSurface) => void;
}) {
  const [ready, setReady] = useState(0);
  useEffect(() => {
    void loadNoteFonts(FONT_CHOICES.map(([font]) => ({ font }))).then(() =>
      setReady(1),
    );
  }, []);
  const font = side.font ?? "serif";
  const align = side.align ?? "left";
  const valign = side.valign ?? "top";
  const pill = (active: boolean) =>
    `rounded-md border px-2 py-1.5 text-xs transition-colors ${active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted"}`;
  return (
    <div className="space-y-3" data-fonts-ready={ready}>
      <div>
        <p className="text-xs">Font</p>
        <div className="mt-1 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Font">
          {FONT_CHOICES.map(([id, name]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={font === id}
              className={pill(font === id)}
              style={{ fontFamily: NOTE_FONT_FAMILIES[id].css, fontSize: "1rem", lineHeight: 1.2 }}
              onClick={() => onChange({ ...side, font: id })}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs">Text position</p>
        <div className="mt-1 flex gap-1.5" role="radiogroup" aria-label="Text alignment">
          {ALIGN_CHOICES.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={align === id}
              aria-label={label}
              title={label}
              className={`${pill(align === id)} flex-1 px-0`}
              onClick={() => onChange({ ...side, align: id })}
            >
              <Icon className="mx-auto size-4" />
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label="Vertical position">
          {(["top", "middle", "bottom"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={valign === id}
              className={`${pill(valign === id)} flex-1 capitalize`}
              onClick={() => onChange({ ...side, valign: id })}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A link sitting on the page in the editor: drag to move, arrow keys to nudge. */
function LinkChip({
  link,
  selected,
  inert,
  page,
  onSelect,
  onMove,
}: {
  link: PageLink;
  selected: boolean;
  inert: boolean;
  page: RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const start = useRef<{ id: number; px: number; py: number; x: number; y: number } | null>(null);
  return (
    <button
      type="button"
      aria-label={`Move link: ${linkName(link) || "new link"}`}
      aria-pressed={selected}
      disabled={inert}
      className={`absolute touch-none ${inert ? "" : "cursor-move"} rounded-[22%] ${selected ? "z-10 outline outline-2 outline-offset-2 outline-[var(--color-leaf,#6b8f4e)]" : ""}`}
      style={{ left: `${link.x * 100}%`, top: `${link.y * 100}%`, width: `${link.size * 100}%` }}
      onFocus={onSelect}
      onPointerDown={(e) => {
        if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { id: e.pointerId, px: e.clientX, py: e.clientY, x: link.x, y: link.y };
      }}
      onPointerMove={(e) => {
        const g = start.current;
        const rect = page.current?.getBoundingClientRect();
        if (!g || g.id !== e.pointerId || !rect) return;
        onMove(g.x + (e.clientX - g.px) / rect.width, g.y + (e.clientY - g.py) / rect.height);
      }}
      onPointerUp={(e) => {
        if (start.current?.id === e.pointerId) start.current = null;
      }}
      onPointerCancel={() => (start.current = null)}
      onKeyDown={(e) => {
        const d = e.shiftKey ? 0.02 : 0.005;
        const v: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
        if (v[e.key]) {
          e.preventDefault();
          e.stopPropagation();
          onMove(link.x + v[e.key]![0], link.y + v[e.key]![1]);
        }
      }}
    >
      <LinkLogo link={link} />
    </button>
  );
}

const pageOptions = (leaves: Leaf[]) =>
  leaves.map((l, i) => (
    <option key={i} value={i}>
      Page {l.page}
      {l.half ? ` · ${l.half} half` : ""}
    </option>
  ));

function TagsPanel({
  tags,
  leaves,
  leaf,
  onAdd,
  onEdit,
  onRemove,
}: {
  tags: PageTag[];
  leaves: Leaf[];
  leaf?: Leaf;
  onAdd: () => void;
  onEdit: (id: string, patch: Partial<PageTag>) => void;
  onRemove: (id: string) => void;
}) {
  const pages = [...new Set(leaves.map((l) => l.page))];
  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Tabs stick out of the edge of the book, even when it is closed. Tap one and the book turns straight to its page.
      </p>
      <Button size="sm" variant="line" disabled={!leaf || tags.length >= MAX_TAGS} onClick={onAdd}>
        + Add a tab{leaf ? ` to page ${leaf.page}` : ""}
      </Button>
      {tags.length === 0 && <p className="text-sm text-muted-foreground">No tabs yet.</p>}
      <ul className="space-y-3">
        {[...tags].sort((a, b) => a.page - b.page).map((t) => (
          <li key={t.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-7 w-5 shrink-0 rounded-r-md shadow-sm"
                style={{ background: t.colour }}
              />
              <input
                aria-label="Tab text"
                className="min-w-0 flex-1 rounded border bg-background p-2 text-sm"
                placeholder="Tab text, e.g. Contact"
                maxLength={TAG_LABEL_LIMIT}
                value={t.label}
                onChange={(e) => onEdit(t.id, { label: e.target.value })}
              />
              <button
                type="button"
                aria-label="Remove tab"
                className="rounded p-2 text-xs text-destructive hover:bg-muted"
                onClick={() => onRemove(t.id)}
              >
                Remove
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Tab colour">
              {TAG_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={t.colour === c}
                  aria-label={`Colour ${c}`}
                  className={`size-6 rounded-full border ${t.colour === c ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                  style={{ background: c }}
                  onClick={() => onEdit(t.id, { colour: c })}
                />
              ))}
              <label className="ml-1 text-xs">
                <span className="sr-only">Custom colour</span>
                <input
                  type="color"
                  className="size-7 cursor-pointer rounded border bg-background p-0.5"
                  value={t.colour}
                  onChange={(e) => onEdit(t.id, { colour: e.target.value })}
                />
              </label>
            </div>
            <label className="block text-xs">
              Opens page
              <select
                className="mt-1 w-full rounded border bg-background p-2 text-sm"
                value={t.page}
                onChange={(e) => onEdit(t.id, { page: Number(e.target.value) })}
              >
                {pages.map((n) => (
                  <option key={n} value={n}>
                    Page {n}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinksPanel({
  links,
  selected,
  leaves,
  busy,
  onSelect,
  onAdd,
  onEdit,
  onMovePage,
  onLogo,
  onRemove,
}: {
  links: PageLink[];
  selected: string | null;
  leaves: Leaf[];
  busy: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (id: string, patch: Partial<PageLink>) => void;
  onMovePage: (id: string, leafIndex: number) => void;
  onLogo: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const link = links.find((l) => l.id === selected);
  const [draft, setDraft] = useState(link?.url ?? "");
  useEffect(() => setDraft(link?.url ?? ""), [link?.id]);
  const leafIndex = link ? Math.max(0, leaves.findIndex((l) => l.page === link.page && (!l.half || l.half === link.half))) : 0;
  const bad = !!draft.trim() && !normaliseUrl(draft);
  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Add a link to any website. Visitors tap its logo to open the site in a new tab. The logo is the website's own unless you choose another.
      </p>
      <Button size="sm" variant="line" disabled={links.length >= MAX_LINKS} onClick={onAdd}>
        + Add a link to this page
      </Button>
      {links.length > 1 && (
        <label className="block text-xs">
          Select link
          <select
            className="mt-1 w-full rounded border bg-background p-2 text-sm"
            value={selected ?? ""}
            onChange={(e) => onSelect(e.target.value)}
          >
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {linkName(l) || "New link"} · page {l.page}
              </option>
            ))}
          </select>
        </label>
      )}
      {link ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-14 shrink-0">
              <LinkLogo link={link} />
            </div>
            <div className="min-w-0 text-xs">
              <p className="truncate font-medium">{linkName(link) || "New link"}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Button size="sm" variant="line" disabled={busy} onClick={() => onLogo(link.id)}>
                  {link.iconKey ? "Change logo" : "Use my own logo"}
                </Button>
                {link.iconKey && (
                  <Button size="sm" variant="quiet" onClick={() => onEdit(link.id, { iconKey: undefined })}>
                    Use the site's logo
                  </Button>
                )}
              </div>
            </div>
          </div>
          <label className="block text-xs">
            Web address
            <input
              className={`mt-1 w-full rounded border bg-background p-2 text-sm ${bad ? "border-destructive" : ""}`}
              placeholder="behance.net/yourname"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={draft}
              aria-invalid={bad}
              onChange={(e) => {
                setDraft(e.target.value);
                const n = normaliseUrl(e.target.value);
                if (n) onEdit(link.id, { url: n });
              }}
              onBlur={() => {
                const n = normaliseUrl(draft);
                if (n) setDraft(n);
              }}
            />
            {bad && <span className="mt-1 block text-destructive">That doesn't look like a web address.</span>}
          </label>
          <label className="block text-xs">
            Caption (optional)
            <input
              className="mt-1 w-full rounded border bg-background p-2 text-sm"
              maxLength={40}
              placeholder="My Behance"
              value={link.label ?? ""}
              onChange={(e) => onEdit(link.id, { label: e.target.value })}
            />
          </label>
          <label className="block text-xs">
            Size
            <input
              type="range"
              className="mt-1 w-full"
              min={LINK_SIZE.min * 100}
              max={LINK_SIZE.max * 100}
              value={Math.round(link.size * 100)}
              onChange={(e) => onEdit(link.id, placeLink({ ...link, size: Number(e.target.value) / 100 }, link.x, link.y))}
            />
          </label>
          <label className="block text-xs">
            On page
            <select
              className="mt-1 w-full rounded border bg-background p-2 text-sm"
              value={leafIndex}
              onChange={(e) => onMovePage(link.id, Number(e.target.value))}
            >
              {pageOptions(leaves)}
            </select>
          </label>
          <Button size="sm" variant="quiet" className="text-destructive" onClick={() => onRemove(link.id)}>
            Remove link
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Add a link, then drag its logo where you want it on the page.</p>
      )}
    </div>
  );
}
