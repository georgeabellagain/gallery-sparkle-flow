import { useContext, useEffect, useRef, useState, type PointerEvent } from "react";
import { LiveScrapbookContext } from "./live-scrapbook-context";
import { NoteSurface } from "./FoldoutCard";
import { LinkLogo } from "./PageLinks";
import {
  foldoutsForLeaf,
  foldoutSurfaces,
  type Foldout,
  type ResizeCorner,
} from "@/lib/portfolia/foldouts";
import { linksForLeaf, tabSlots, type PageLink, type PageTag } from "@/lib/portfolia/page-extras";
import { tabSlot } from "@/lib/portfolia/tab-geometry";
import type { Leaf } from "@/lib/portfolia/book-layout";
import { patchPortfolioExtra } from "@/lib/portfolia/store";
import { transformExtra, type Extra, type ExtraKind } from "@/lib/portfolia/scrapbook-transform";
export function LiveScrapbookPage({
  leaf,
  side,
  ratio,
}: {
  leaf: Leaf;
  side: "left" | "right";
  ratio: number;
}) {
  const context = useContext(LiveScrapbookContext)!;
  const pdf = context.portfolio.pdf!;
  const root = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ kind: ExtraKind; item: Extra } | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{
    kind: ExtraKind;
    item: Extra;
    x: number;
    y: number;
    width: number;
    height: number;
    handle: "move" | ResizeCorner;
    next: Extra;
  } | null>(null);
  useEffect(() => setDraft(null), [pdf.foldouts, pdf.links, pdf.tags]);
  const commit = (kind: ExtraKind, item: Extra) =>
    context.onError(
      patchPortfolioExtra(context.portfolio.code, pdf.blobKey, kind, item.id, item)
        ? null
        : "The item could not be saved. Please try again.",
    );
  const begin = (
    e: PointerEvent<HTMLButtonElement>,
    kind: ExtraKind,
    item: Extra,
    handle: "move" | ResizeCorner,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(item.id);
    const bounds = root.current!.getBoundingClientRect();
    drag.current = {
      kind,
      item,
      x: e.clientX,
      y: e.clientY,
      width: bounds.width,
      height: bounds.height,
      handle,
      next: item,
    };
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    d.next = transformExtra(
      d.kind,
      d.item,
      (e.clientX - d.x) / d.width,
      (e.clientY - d.y) / d.height,
      d.handle,
      ratio,
    );
    setDraft({ kind: d.kind, item: d.next });
  };
  const end = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const d = drag.current;
    drag.current = null;
    if (d) commit(d.kind, d.next);
  };
  const cancel = () => {
    drag.current = null;
    setDraft(null);
  };
  const live = <T extends Extra>(item: T) =>
    draft?.item.id === item.id ? (draft.item as T) : item;
  const controls = (kind: ExtraKind, item: Extra, handle: "move" | ResizeCorner) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => begin(e, kind, item, handle),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      const dx = e.key === "ArrowRight" ? 0.005 : e.key === "ArrowLeft" ? -0.005 : 0,
        dy = e.key === "ArrowDown" ? 0.005 : e.key === "ArrowUp" ? -0.005 : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      e.stopPropagation();
      commit(kind, transformExtra(kind, item, dx, dy, handle, ratio));
    },
  });
  const resize = (kind: ExtraKind, item: Extra, all = false) =>
    (all ? ["nw", "ne", "sw", "se"] : ["se"]).map((corner) => (
      <button
        key={corner}
        type="button"
        aria-label={`Resize ${kind === "foldouts" ? "note" : kind === "tags" ? "tab" : "link"} ${corner}`}
        {...controls(kind, item, corner as ResizeCorner)}
        className={`pointer-events-auto absolute z-20 size-3 touch-none border border-white bg-blue-600 ${corner.includes("n") ? "-top-1.5" : "-bottom-1.5"} ${corner.includes("w") ? "-left-1.5" : "-right-1.5"}`}
        style={{ cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize" }}
      />
    ));
  return (
    <div ref={root} className="pointer-events-none absolute inset-0" data-live-scrapbook>
      {foldoutsForLeaf(pdf.foldouts ?? [], leaf).map((original) => {
        const f = live(original);
        return (
          <div
            key={f.id}
            className="absolute pointer-events-auto ring-2 ring-blue-500 shadow-md"
            style={{
              left: `${f.x * 100}%`,
              top: `${f.y * 100}%`,
              width: `${f.width * 100}%`,
              height: `${f.height * 100}%`,
            }}
          >
            <NoteSurface side={foldoutSurfaces(f).outside} sticky={f.style === "sticky"} />
            <button
              type="button"
              aria-label={`Move ${f.style === "sticky" ? "sticky note" : "fold-out"} ${f.title || ""}`}
              {...controls("foldouts", f, "move")}
              className="absolute inset-0 touch-none cursor-move bg-transparent"
            />
            {resize("foldouts", f, true)}
          </div>
        );
      })}
      {linksForLeaf(pdf.links ?? [], leaf).map((original) => {
        const l = live(original);
        return (
          <div
            key={l.id}
            className="absolute pointer-events-auto ring-2 ring-blue-500"
            style={{
              left: `${l.x * 100}%`,
              top: `${l.y * 100}%`,
              width: `${l.size * 100}%`,
              aspectRatio: "1",
            }}
          >
            <LinkLogo link={l} />
            <button
              type="button"
              aria-label={`Move website link ${l.label || l.url}`}
              {...controls("links", l, "move")}
              className="absolute inset-0 touch-none cursor-move bg-transparent"
            />
            {resize("links", l)}
          </div>
        );
      })}
      {tabSlots(pdf.tags ?? [])
        .filter((t) => t.page === leaf.page && (!leaf.half || leaf.half === side))
        .map((original) => {
          const t = live(original);
          const slot = tabSlot(ratio, original.slot, original.of, t.position, t.scale);
          const positioned = { ...t, position: 0.5 - slot.y / ratio };
          return (
            <div
              key={t.id}
              className="absolute pointer-events-auto ring-2 ring-blue-500"
              style={{
                left: side === "left" ? "-7.5%" : "100%",
                top: `${(0.5 - slot.y / ratio - slot.height / ratio / 2) * 100}%`,
                width: "7.5%",
                height: `${(slot.height / ratio) * 100}%`,
                background: t.colour,
              }}
            >
              <button
                type="button"
                aria-label={`Move page tab ${t.label}`}
                {...controls("tags", positioned, "move")}
                className="absolute inset-0 touch-none cursor-move overflow-hidden text-[10px] text-black"
                style={{ writingMode: "vertical-rl" }}
              >
                {t.label}
              </button>
              {resize("tags", positioned)}
            </div>
          );
        })}
      {selected && (
        <span className="sr-only" aria-live="polite">
          Selected item. Drag to move or use arrow keys.
        </span>
      )}
    </div>
  );
}
