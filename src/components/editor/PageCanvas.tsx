import { useRef, useState } from "react";
import { Crop, ImagePlus, MousePointer2, Scan, Trash2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetImage } from "@/components/portfolia/AssetImage";
import { textStyleToCss } from "@/components/portfolia/Blocks";
import { findElement, patchItem, useEditor } from "./editorContext";
import { uid } from "@/lib/portfolia/assets";
import { cropRegionToItem, uploadFileAsset } from "@/lib/portfolia/uploads";
import type { Hotspot, PageItem } from "@/lib/portfolia/types";
import { cn } from "@/lib/utils";

type Tool = "select" | "hotspot" | "crop";
type Drag =
  | { mode: "move" | "resize" | "rotate"; elId: string; startX: number; startY: number; base: number[] }
  | null;

const SNAP = 1; // percent grid when snapping is on

export function PageCanvas({ item }: { item: PageItem }) {
  const { portfolio, projectId, selection, select, advanced, notify } = useEditor();
  const [tool, setTool] = useState<Tool>("select");
  const [snap, setSnap] = useState(true);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ep = (elId: string, fn: Parameters<typeof patchItem>[3], history = false) =>
    patchItem(portfolio.id, projectId, item.id, fn, history);

  const pct = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const q = (v: number) => (snap && advanced ? Math.round(v / SNAP) * SNAP : Math.round(v * 100) / 100);

  /* ------------------------------------------------------- element drags -- */
  const onElementPointerDown = (
    e: React.PointerEvent,
    elId: string,
    mode: "move" | "resize" | "rotate",
  ) => {
    const el = findElement(item, elId);
    if (!el || el.locked || !advanced) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = pct(e);
    dragRef.current = {
      mode,
      elId,
      startX: p.x,
      startY: p.y,
      base: [el.x, el.y, el.w, el.h, el.rotation],
    };
    select({ itemId: item.id, elementId: elId });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = pct(e);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    ep(d.elId, (i) => {
      if (!("elements" in i)) return;
      const el = i.elements.find((x) => x.id === d.elId);
      if (!el) return;
      const [bx, by, bw, bh, br] = d.base as [number, number, number, number, number];
      if (d.mode === "move") {
        el.x = q(bx + dx);
        el.y = q(by + dy);
      } else if (d.mode === "resize") {
        el.w = Math.max(3, q(bw + dx));
        el.h = Math.max(3, q(bh + dy));
      } else {
        el.rotation = Math.round(br + dx * 2);
      }
    });
  };

  const endDrag = () => {
    if (dragRef.current) {
      // Commit one history entry for the completed gesture.
      patchItem(portfolio.id, projectId, item.id, () => {});
      dragRef.current = null;
    }
  };

  /* ------------------------------------------------- hotspot / crop draw -- */
  const drawRef = useRef<{ x: number; y: number } | null>(null);

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (tool === "select") {
      select({ itemId: item.id });
      return;
    }
    const p = pct(e);
    drawRef.current = p;
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (!drawRef.current) return onPointerMove(e);
    const p = pct(e);
    const s = drawRef.current;
    setRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };

  const onCanvasPointerUp = async () => {
    endDrag();
    const r = rect;
    drawRef.current = null;
    setRect(null);
    if (!r || r.w < 2 || r.h < 2) return;
    const norm = { x: r.x / 100, y: r.y / 100, w: r.w / 100, h: r.h / 100 };
    if (tool === "hotspot") {
      const id = uid("hs");
      patchItem(portfolio.id, projectId, item.id, (i) => {
        if (!("hotspots" in i)) return;
        i.hotspots = [...(i.hotspots ?? []), { id, ...norm, action: "viewer", label: "" }];
      });
      select({ itemId: item.id, hotspotId: id });
      setTool("select");
      return;
    }
    if (tool === "crop") {
      if (!item.assetId) {
        notify("This page has no background image to crop.", "error");
        return;
      }
      setBusy(true);
      try {
        await cropRegionToItem(item.assetId, norm, {
          portfolioId: portfolio.id,
          projectId,
          label: "Cropped region",
        });
        notify("Region saved as a separate image item. The page itself is unchanged.");
      } catch (err) {
        notify(err instanceof Error ? err.message : "The region could not be cropped.", "error");
      } finally {
        setBusy(false);
        setTool("select");
      }
    }
  };

  const addText = () => {
    const id = uid("el");
    patchItem(portfolio.id, projectId, item.id, (i) => {
      if (!("elements" in i)) return;
      i.elements.push({
        id,
        kind: "text",
        x: 12,
        y: 12,
        w: 50,
        h: 10,
        rotation: 0,
        z: i.elements.length + 1,
        opacity: 1,
        text: "New text",
        style: { size: 18 },
      });
    });
    select({ itemId: item.id, elementId: id });
  };

  const addImage = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const assetId = await uploadFileAsset(file);
      const id = uid("el");
      patchItem(portfolio.id, projectId, item.id, (i) => {
        if (!("elements" in i)) return;
        i.elements.push({
          id,
          kind: "image",
          x: 15,
          y: 15,
          w: 45,
          h: 35,
          rotation: 0,
          z: i.elements.length + 1,
          opacity: 1,
          assetId,
          alt: "",
          details: {},
        });
      });
      select({ itemId: item.id, elementId: id });
    } catch {
      notify("That image could not be added. Everything else is untouched.", "error");
    } finally {
      setBusy(false);
    }
  };

  const hotspot = (item.hotspots ?? []).find((h) => h.id === selection.hotspotId);

  return (
    <div className="flex h-full flex-col">
      <div className="rule-b flex flex-wrap items-center gap-1.5 px-4 py-2">
        <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={<MousePointer2 />} label="Select" />
        <ToolButton active={tool === "hotspot"} onClick={() => setTool("hotspot")} icon={<Scan />} label="Clickable region" />
        <ToolButton active={tool === "crop"} onClick={() => setTool("crop")} icon={<Crop />} label="Crop region out" />
        <span className="mx-1 h-5 w-px bg-border" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void addImage(e.target.files?.[0])} />
        <Button size="xs" variant="line" onClick={() => fileRef.current?.click()}>
          <ImagePlus /> Image
        </Button>
        <Button size="xs" variant="line" onClick={addText}>
          <Type /> Text
        </Button>
        {advanced && (
          <label className="ml-2 flex items-center gap-1.5 text-xxs text-muted-foreground">
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="size-3.5 accent-foreground" />
            Snap to guides
          </label>
        )}
        <span className="ml-auto text-xxs text-muted-foreground">
          {item.kind === "pdfPage" ? "Imported page — kept as designed" : "Designed page"}
          {busy ? " · working…" : ""}
        </span>
      </div>

      {!advanced && (
        <p className="rule-b bg-muted/40 px-4 py-2 text-xxs text-muted-foreground">
          Turn on Advanced controls to move, resize, rotate and stack elements freely.
        </p>
      )}
      {tool !== "select" && (
        <p className="rule-b bg-muted/40 px-4 py-2 text-xxs text-muted-foreground">
          {tool === "hotspot"
            ? "Drag a rectangle over the page to add a clickable region. It is stored in page proportions, so it stays aligned at every size."
            : "Drag a rectangle to save that region as a separate image item. The page stays intact."}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-canvas p-8">
        <div className="mx-auto w-full max-w-3xl">
          <div
            ref={boxRef}
            className={cn(
              "relative w-full select-none bg-white hairline",
              tool !== "select" && "cursor-crosshair",
            )}
            style={{ aspectRatio: String(item.aspect || 0.75), background: item.background || "#fff" }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={() => void onCanvasPointerUp()}
            onPointerCancel={() => void onCanvasPointerUp()}
          >
            {item.assetId && (
              <AssetImage assetId={item.assetId} alt="" fit="contain" className="pointer-events-none absolute inset-0 h-full w-full" />
            )}

            {advanced && snap && (
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
                  backgroundSize: "10% 10%",
                }}
              />
            )}

            {(item.hotspots ?? []).map((h) => (
              <button
                key={h.id}
                type="button"
                onPointerDown={(e) => {
                  if (tool !== "select") return;
                  e.stopPropagation();
                  select({ itemId: item.id, hotspotId: h.id });
                }}
                className={cn(
                  "absolute border border-dashed",
                  selection.hotspotId === h.id ? "border-foreground bg-foreground/10" : "border-foreground/40",
                )}
                style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}
                aria-label={h.label || "Clickable region"}
              />
            ))}

            {item.elements
              .slice()
              .sort((a, b) => a.z - b.z)
              .map((el) => {
                const active = selection.elementId === el.id;
                return (
                  <div
                    key={el.id}
                    className={cn(
                      "absolute",
                      el.hidden && "opacity-25",
                      active ? "outline outline-1 outline-foreground" : "hover:outline hover:outline-1 hover:outline-border-strong",
                      advanced && !el.locked && "cursor-move",
                    )}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.w}%`,
                      height: `${el.h}%`,
                      transform: `rotate(${el.rotation}deg)`,
                      opacity: el.hidden ? 0.25 : el.opacity,
                      zIndex: el.z,
                    }}
                    onPointerDown={(e) => {
                      if (tool !== "select") return;
                      select({ itemId: item.id, elementId: el.id });
                      onElementPointerDown(e, el.id, "move");
                    }}
                  >
                    {el.kind === "image" ? (
                      <AssetImage assetId={el.assetId} alt={el.alt || ""} crop={el.crop} focal={el.focal} className="pointer-events-none h-full w-full" />
                    ) : (
                      <p
                        className="h-full w-full outline-none"
                        style={textStyleToCss(el.style, portfolio.theme)}
                        contentEditable={!el.locked}
                        suppressContentEditableWarning
                        onPointerDown={(e) => e.stopPropagation()}
                        onBlur={(e) =>
                          patchItem(portfolio.id, projectId, item.id, (i) => {
                            if (!("elements" in i)) return;
                            const t = i.elements.find((x) => x.id === el.id);
                            if (t) t.text = e.currentTarget.textContent ?? "";
                          })
                        }
                      >
                        {el.text}
                      </p>
                    )}
                    {active && advanced && !el.locked && (
                      <>
                        <span
                          role="button"
                          aria-label="Resize"
                          className="absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize border border-foreground bg-background"
                          onPointerDown={(e) => onElementPointerDown(e, el.id, "resize")}
                        />
                        <span
                          role="button"
                          aria-label="Rotate"
                          className="absolute -top-1.5 -right-1.5 size-3 cursor-grab rounded-full border border-foreground bg-background"
                          onPointerDown={(e) => onElementPointerDown(e, el.id, "rotate")}
                        />
                      </>
                    )}
                  </div>
                );
              })}

            {rect && (
              <div
                className="pointer-events-none absolute border border-foreground bg-foreground/10"
                style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
              />
            )}
          </div>

          {hotspot && <HotspotEditor item={item} hotspot={hotspot} />}

          {advanced && item.elements.length > 0 && (
            <div className="mt-6">
              <h3 className="label-xs">Layers</h3>
              <ul className="mt-2 divide-y divide-border border border-border bg-background">
                {item.elements
                  .slice()
                  .sort((a, b) => b.z - a.z)
                  .map((el) => (
                    <li key={el.id} className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        className={cn(
                          "min-w-0 flex-1 truncate text-left text-xs",
                          selection.elementId === el.id && "font-medium",
                        )}
                        onClick={() => select({ itemId: item.id, elementId: el.id })}
                      >
                        {el.kind === "text" ? el.text?.slice(0, 32) || "Text" : "Image"}
                      </button>
                      <span className="text-xxs text-muted-foreground">z {el.z}</span>
                      <Button
                        size="icon-sm"
                        variant="quiet"
                        aria-label="Bring forward"
                        onClick={() => ep(el.id, (i) => {
                          if (!("elements" in i)) return;
                          const t = i.elements.find((x) => x.id === el.id);
                          if (t) t.z = t.z + 1;
                        }, true)}
                      >
                        ↑
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="quiet"
                        aria-label="Send backward"
                        onClick={() => ep(el.id, (i) => {
                          if (!("elements" in i)) return;
                          const t = i.elements.find((x) => x.id === el.id);
                          if (t) t.z = Math.max(0, t.z - 1);
                        }, true)}
                      >
                        ↓
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button size="xs" variant={active ? "default" : "line"} onClick={onClick} title={label}>
      {icon} {label}
    </Button>
  );
}

function HotspotEditor({ item, hotspot }: { item: PageItem; hotspot: Hotspot }) {
  const { portfolio, projectId, select } = useEditor();
  const set = (fn: (h: Hotspot) => void, history = false) =>
    patchItem(
      portfolio.id,
      projectId,
      item.id,
      (i) => {
        if (!("hotspots" in i)) return;
        const h = i.hotspots?.find((x) => x.id === hotspot.id);
        if (h) fn(h);
      },
      history,
    );

  return (
    <div className="mt-6 border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="label-xs">Clickable region</h3>
        <Button
          size="xs"
          variant="quiet"
          onClick={() => {
            patchItem(portfolio.id, projectId, item.id, (i) => {
              if (!("hotspots" in i)) return;
              i.hotspots = (i.hotspots ?? []).filter((h) => h.id !== hotspot.id);
            });
            select({ itemId: item.id });
          }}
        >
          <Trash2 /> Remove
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xxs text-muted-foreground">
          Label
          <input
            value={hotspot.label ?? ""}
            onChange={(e) => set((h) => void (h.label = e.target.value))}
            className="mt-1 h-8 w-full border border-input bg-background px-2 text-sm"
          />
        </label>
        <label className="text-xxs text-muted-foreground">
          On click
          <select
            value={hotspot.action}
            onChange={(e) => set((h) => void (h.action = e.target.value as Hotspot["action"]), true)}
            className="mt-1 h-8 w-full border border-input bg-background px-2 text-sm"
          >
            <option value="viewer">Open the image viewer</option>
            <option value="link">Open an external link</option>
          </select>
        </label>
        {hotspot.action === "link" && (
          <label className="text-xxs text-muted-foreground sm:col-span-2">
            Link address
            <input
              value={hotspot.href ?? ""}
              placeholder="https://"
              onChange={(e) => set((h) => void (h.href = e.target.value))}
              className="mt-1 h-8 w-full border border-input bg-background px-2 font-mono text-xs"
            />
          </label>
        )}
        {hotspot.action === "viewer" && (
          <label className="text-xxs text-muted-foreground sm:col-span-2">
            Viewer title (optional)
            <input
              value={hotspot.details?.title ?? ""}
              onChange={(e) => set((h) => void (h.details = { ...h.details, title: e.target.value }))}
              className="mt-1 h-8 w-full border border-input bg-background px-2 text-sm"
            />
          </label>
        )}
        {hotspot.action === "viewer" && (
          <label className="text-xxs text-muted-foreground sm:col-span-2">
            Viewer description (optional)
            <textarea
              value={hotspot.details?.description ?? ""}
              rows={2}
              onChange={(e) => set((h) => void (h.details = { ...h.details, description: e.target.value }))}
              className="mt-1 w-full border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
        )}
      </div>
    </div>
  );
}
